<?php

/**
 * Dynamic Reporting API
 * Routes: /api/query, /api/schema, /api/facets, /api/views, /api/produce
 */

require_once __DIR__ . '/../vendor/autoload.php';

use Monolog\Logger;
use Monolog\Handler\StreamHandler;

// ── CORS Headers ──────────────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Config ────────────────────────────────────────────────────────────────────
$solrUrl = getenv('SOLR_URL') ?: 'http://solr:8983/solr/csvcore';
$kafkaBroker = getenv('KAFKA_BROKER') ?: 'kafka:9092';

$log = new Logger('api');
$log->pushHandler(new StreamHandler('php://stderr', Logger::WARNING));

// ── Router ────────────────────────────────────────────────────────────────────
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

$uri = preg_replace('#^/api#', '', $uri);

switch (true) {
    case $uri === '/query'  && $method === 'POST': handleQuery($solrUrl);  break;
    case $uri === '/schema' && $method === 'GET':  handleSchema($solrUrl); break;
    case $uri === '/facets' && $method === 'POST': handleFacets($solrUrl); break;
    case $uri === '/views'  && $method === 'GET':  handleGetViews();       break;
    case $uri === '/views'  && $method === 'POST': handleSaveView();       break;
    case $uri === '/views'  && $method === 'DELETE': handleDeleteView();   break;
    case $uri === '/produce'&& $method === 'POST': handleProduce($kafkaBroker); break;
    case $uri === '/aggregations' && $method === 'POST': handleAggregations($solrUrl); break;
    case $uri === '/column-config' && $method === 'GET': handleGetColumnConfig(); break;
    case $uri === '/column-config' && $method === 'POST': handleSaveColumnConfig(); break;
    case $uri === '/sources' && $method === 'GET': handleGetSources($solrUrl); break;
    case $uri === '/health' && $method === 'GET':  json(['status' => 'ok', 'time' => date('c')]); break;
    default:
        http_response_code(404);
        json(['error' => 'Not found', 'path' => $uri]);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleQuery(string $solrUrl): void
{
    $body = getBody();

    $rows    = (int)($body['rows']   ?? 50);
    $cursor  = $body['cursor'] ?? null;
    $sort    = $body['sort']   ?? 'score desc';
    
    // Solr cursorMark requires unique key in sort
    if ($cursor && !str_contains($sort, 'id ')) {
        $sort .= ', id asc';
    }

    $q       = $body['q']     ?? '*:*';
    $fields  = $body['fields'] ?? ['*'];
    $filters = $body['filters'] ?? [];
    $dateRange = $body['dateRange'] ?? null;
    $dateField = $body['dateField'] ?? 'ingested_at_dt';
    $dateCompare = $body['dateCompare'] ?? null;

    $fqs = buildFilterQueries($filters);

    // Apply Global Date Filter
    if ($dateRange && ($dateRange['from'] ?? null) && ($dateRange['to'] ?? null)) {
        $from = date('Y-m-d\TH:i:s\Z', strtotime($dateRange['from'] . ' 00:00:00'));
        $to   = date('Y-m-d\TH:i:s\Z', strtotime($dateRange['to'] . ' 23:59:59'));
        $fqs[] = "$dateField:[$from TO $to]";
    }

    $params = [
        'q'     => $q,
        'rows'  => $rows,
        'sort'  => $sort,
        'fl'    => implode(',', $fields),
        'wt'    => 'json',
        'indent' => 'false',
    ];

    if ($cursor) {
        $params['cursorMark'] = $cursor;
    } else {
        $page    = (int)($body['page']   ?? 1);
        $params['start']   = ($page - 1) * $rows;
    }

    if (!empty($fqs)) {
        $params['fq'] = $fqs;
    }

    // Date compare: dual query
    if ($dateCompare) {
        $result = executeDateCompare($solrUrl, $params, $dateCompare);
        json($result);
        return;
    }

    // Caching layer
    $cacheKey = md5(json_encode($params));
    $cacheDir = sys_get_temp_dir() . '/api_cache';
    @mkdir($cacheDir, 0777, true);
    $cacheFile = "$cacheDir/$cacheKey.json";
    
    if (file_exists($cacheFile) && filemtime($cacheFile) > time() - 60) {
        $cachedData = json_decode(file_get_contents($cacheFile), true) ?? [];
        if (!empty($cachedData)) {
            $cachedData['from_cache'] = true;
            json($cachedData);
            return;
        }
    }

    $response = solrRequest($solrUrl . '/select', $params);
    $data = json_decode($response, true);

    $result = [
        'total'    => $data['response']['numFound'] ?? 0,
        'rows'     => $rows,
        'docs'     => $data['response']['docs'] ?? [],
        'facets'   => $data['facet_counts'] ?? null,
        'timing'   => $data['responseHeader']['QTime'] ?? null,
    ];
    if (isset($data['nextCursorMark'])) {
        $result['nextCursorMark'] = $data['nextCursorMark'];
    }

    file_put_contents($cacheFile, json_encode($result));
    json($result);
}

function handleSchema(string $solrUrl): void
{
    $source = $_GET['source'] ?? null;
    $response = solrGet($solrUrl . '/schema/fields?wt=json&indent=false');
    $data = json_decode($response, true);

    $fields = [];
    foreach (($data['fields'] ?? []) as $field) {
        $name = $field['name'];
        if (str_starts_with($name, '_')) continue;

        $solrType = $field['type'] ?? '';
        $type = 'string';
        if (str_contains(strtolower($solrType), 'int') || str_contains(strtolower($solrType), 'long')) $type = 'integer';
        elseif (str_contains(strtolower($solrType), 'float') || str_contains(strtolower($solrType), 'double')) $type = 'float';
        elseif (str_contains(strtolower($solrType), 'bool')) $type = 'boolean';
        elseif (str_contains(strtolower($solrType), 'date')) $type = 'date';
        else $type = inferType($name);

        $fields[] = [
            'name'       => $name,
            'label'      => formatLabel($name),
            'type'       => $type,
            'sortable'   => true,
            'filterable' => true,
        ];
    }

    // Also get dynamic field examples by querying a sample doc
    $query = $source ? 'source_file_s:"' . addslashes($source) . '"' : '*:*';
    $sampleResp = solrGet($solrUrl . '/select?q=' . urlencode($query) . '&rows=1&wt=json');
    $sampleData = json_decode($sampleResp, true);
    $sampleDoc  = $sampleData['response']['docs'][0] ?? [];

    $dynamicFields = [];
    foreach ($sampleDoc as $key => $val) {
        if (str_starts_with($key, '_') || $key === 'id') continue;
        $phpType = gettype($val);
        $inferred = 'string';
        if ($phpType === 'integer') $inferred = 'integer';
        elseif ($phpType === 'double') $inferred = 'float';
        elseif ($phpType === 'boolean') $inferred = 'boolean';
        elseif ($phpType === 'string' && preg_match('/^\d{4}-\d{2}-\d{2}T/', $val)) $inferred = 'date';
        elseif ($phpType === 'string' && is_numeric($val)) {
            $inferred = str_contains($val, '.') ? 'float' : 'integer';
        }
        else $inferred = inferType($key);

        $dynamicFields[] = [
            'name'       => $key,
            'label'      => formatLabel($key),
            'type'       => $inferred,
            'sortable'   => true,
            'filterable' => true,
        ];
    }

    // Merge explicitly defined fields with dynamically discovered fields
    $allFields = $fields;
    $existingNames = array_column($fields, 'name');
    
    foreach ($dynamicFields as $df) {
        $idx = array_search($df['name'], $existingNames);
        if ($idx === false) {
            $allFields[] = $df;
        } else {
            // Upgrade type if dynamic detection found numerical data but static schema only assumed string
            if ($allFields[$idx]['type'] === 'string' && $df['type'] !== 'string') {
                $allFields[$idx]['type'] = $df['type'];
            }
        }
    }

    json(['fields' => $allFields]);
}

function handleFacets(string $solrUrl): void
{
    $body   = getBody();
    $fields = $body['fields'] ?? [];
    $limit  = (int)($body['limit'] ?? 50);
    $prefix = $body['prefix'] ?? '';
    $fqs    = buildFilterQueries($body['filters'] ?? []);

    if (empty($fields)) {
        json(['facets' => []]);
        return;
    }

    $params = [
        'q'           => '*:*',
        'rows'        => 0,
        'facet'       => 'true',
        'facet.limit' => $limit,
        'facet.mincount' => 1,
        'wt'          => 'json',
    ];

    foreach ($fields as $f) {
        $params['facet.field'][] = $f;
    }

    if ($prefix) {
        $params['facet.prefix'] = $prefix;
    }

    if (!empty($fqs)) {
        $params['fq'] = $fqs;
    }

    $response = solrRequest($solrUrl . '/select', $params);
    $data = json_decode($response, true);

    $facets = [];
    $facetFields = $data['facet_counts']['facet_fields'] ?? [];
    foreach ($facetFields as $field => $values) {
        $facets[$field] = [];
        for ($i = 0; $i < count($values); $i += 2) {
            $facets[$field][] = [
                'value' => $values[$i],
                'count' => $values[$i + 1],
            ];
        }
    }

    json(['facets' => $facets]);
}

function handleGetViews(): void
{
    $viewsFile = __DIR__ . '/../storage/views.json';
    if (!file_exists($viewsFile)) {
        json(['views' => []]);
        return;
    }
    $views = json_decode(file_get_contents($viewsFile), true) ?? [];
    json(['views' => $views]);
}

function handleSaveView(): void
{
    $body = getBody();
    if (empty($body['name'])) {
        http_response_code(400);
        json(['error' => 'name required']);
        return;
    }

    $viewsFile = __DIR__ . '/../storage/views.json';
    @mkdir(dirname($viewsFile), 0777, true);

    $views = file_exists($viewsFile)
        ? (json_decode(file_get_contents($viewsFile), true) ?? [])
        : [];

    $viewIdx = -1;
    foreach ($views as $i => $v) {
        if ($v['name'] === $body['name']) { $viewIdx = $i; break; }
    }
    
    $version = 1;
    if ($viewIdx >= 0) {
        $version = ($views[$viewIdx]['version'] ?? 1) + 1;
        $id = $views[$viewIdx]['id'];
    } else {
        $id = 'view_' . uniqid();
    }

    $view = [
        'id'         => $id,
        'name'       => $body['name'],
        'columns'    => $body['columns'] ?? [],
        'filters'    => $body['filters'] ?? [],
        'sort'       => $body['sort'] ?? null,
        'created_at' => date('c'),
        'is_default' => $body['is_default'] ?? false,
        'shared_with_team' => $body['shared_with_team'] ?? false,
        'version'    => $version,
    ];

    if ($viewIdx >= 0) $views[$viewIdx] = $view;
    else $views[] = $view;

    file_put_contents($viewsFile, json_encode($views, JSON_PRETTY_PRINT));

    json(['success' => true, 'view' => $view]);
}

function handleDeleteView(): void
{
    $body = getBody();
    $id   = $body['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        json(['error' => 'id required']);
        return;
    }

    $viewsFile = __DIR__ . '/../storage/views.json';
    $views = file_exists($viewsFile)
        ? (json_decode(file_get_contents($viewsFile), true) ?? [])
        : [];

    $views = array_values(array_filter($views, fn($v) => $v['id'] !== $id));
    file_put_contents($viewsFile, json_encode($views, JSON_PRETTY_PRINT));

    json(['success' => true]);
}

function handleProduce(string $kafkaBroker): void
{
    $body = getBody();

    // Trigger producer script async
    $csvPath = '/app/csv';
    $cmd = "php /app/producer.php $csvPath > /tmp/producer.log 2>&1 &";
    exec($cmd);

    json(['success' => true, 'message' => 'Producer triggered']);
}

function handleAggregations(string $solrUrl): void
{
    $body = getBody();
    $q = $body['q'] ?? '*:*';
    $filters = $body['filters'] ?? [];
    $fqs = buildFilterQueries($filters);
    $groupBy = $body['groupBy'] ?? null;
    $metrics = $body['metrics'] ?? [];

    if (!$groupBy) {
        json(['error' => 'groupBy required']); return;
    }

    $facetJson = [
        'categories' => [
            'type' => 'terms',
            'field' => $groupBy,
            'limit' => 50,
            'facet' => []
        ]
    ];
    
    foreach ($metrics as $m) {
        $type = $m['type']; // 'sum', 'avg', 'count'
        if ($type === 'count') {
            continue; // count is included by default in buckets
        }
        $f = $m['field'];
        if ($f) {
            $facetJson['categories']['facet'][$f . '_' . $type] = "$type($f)";
        }
    }

    $params = [
        'q' => $q,
        'rows' => 0,
        'json.facet' => json_encode($facetJson),
        'wt' => 'json'
    ];
    if (!empty($fqs)) $params['fq'] = $fqs;

    $resp = json_decode(solrRequest($solrUrl . '/select', $params), true);
    json(['aggregations' => $resp['facets']['categories']['buckets'] ?? []]);
}

function handleGetSources(string $solrUrl): void
{
    $params = [
        'q' => '*:*',
        'rows' => 0,
        'facet' => 'true',
        'facet.field' => 'source_file_s',
        'facet.mincount' => 1,
        'wt' => 'json'
    ];
    $resp = json_decode(solrRequest($solrUrl . '/select', $params), true);
    $values = $resp['facet_counts']['facet_fields']['source_file_s'] ?? [];
    
    $sources = [];
    for ($i = 0; $i < count($values); $i += 2) {
        $sources[] = $values[$i];
    }
    json(['sources' => $sources]);
}

function handleGetColumnConfig(): void {
    $body = getBody();
    $userId = $_GET['user_id'] ?? $body['user_id'] ?? 'default';
    $reportId = $_GET['report_id'] ?? $body['report_id'] ?? 'default';
    
    $file = __DIR__ . '/../storage/column_config_' . md5($userId . $reportId) . '.json';
    if (file_exists($file)) json(json_decode(file_get_contents($file), true));
    else json(['user_id' => $userId, 'report_id' => $reportId, 'column_config' => []]);
}

function handleSaveColumnConfig(): void {
    $body = getBody();
    $userId = $body['user_id'] ?? 'default';
    $reportId = $body['report_id'] ?? 'default';
    $config = $body['column_config'] ?? [];
    
    $file = __DIR__ . '/../storage/column_config_' . md5($userId . $reportId) . '.json';
    @mkdir(dirname($file), 0777, true);
    file_put_contents($file, json_encode([
        'user_id' => $userId,
        'report_id' => $reportId,
        'column_config' => $config,
        'updated_at' => date('c')
    ], JSON_PRETTY_PRINT));
    json(['success' => true]);
}

// ── Query Builder ─────────────────────────────────────────────────────────────

function buildFilterQueries(array $filters): array
{
    $fqs = [];
    foreach ($filters as $filter) {
        $fq = buildSingleFilter($filter);
        if ($fq) $fqs[] = $fq;
    }
    return $fqs;
}

function buildSingleFilter(array $filter): ?string
{
    if (!isset($filter['field']) || !isset($filter['type'])) {
        // Handle nested groups
        if (($filter['type'] ?? '') === 'nested') {
            $op = $filter['op'] ?? 'AND';
            $children = $filter['children'] ?? [];
            $parts = array_filter(array_map('buildSingleFilter', $children));
            if (empty($parts)) return null;
            return '(' . implode(" $op ", $parts) . ')';
        }
        return null;
    }

    // 1. Handle spaces in field names for Solr (e.g., "Product Id" -> "Product\ Id")
    $field = str_replace(' ', '\ ', $filter['field']);
    $type = $filter['type'];

    // 2. Handle Range and Date Range (Bypass the 'value' check)
    if ($type === 'range' || $type === 'date_range') {
        $operator = $filter['operator'] ?? null;
        
        // Handle specific operators for single numeric values (e.g., price < 300)
        if ($type === 'range' && $operator && isset($filter['value']) && $filter['value'] !== '') {
            $val = str_replace(',', '', (string)$filter['value']);
            switch ($operator) {
                case '<':  return "$field:{* TO $val}";
                case '>':  return "$field:{$val} TO *}";
                case '<=': return "$field:[* TO $val]";
                case '>=': return "$field:[$val TO *]";
                case '=':  return "$field:\"$val\"";
            }
        }

        // Fallback to min/max range
        // Support both UI keys: 'from'/'to' (dates) and 'min'/'max' (numbers)
        $from = $filter['from'] ?? $filter['min'] ?? '*';
        $to   = $filter['to']   ?? $filter['max'] ?? '*';
        
        if ($from === '') $from = '*';
        if ($to   === '') $to   = '*';

        // Strip commas if they are numeric ranges
        $from = str_replace(',', '', (string)$from);
        $to = str_replace(',', '', (string)$to);

        // Convert to Solr date format if it looks like a date and it's a date_range
        if ($type === 'date_range') {
            if ($from !== '*') $from = date('Y-m-d\TH:i:s\Z', strtotime($from));
            if ($to   !== '*') $to   = date('Y-m-d\TH:i:s\Z', strtotime($to));
        }
        
        return "$field:[$from TO $to]";
    }

    // 3. Reject other filters if 'value' is missing
    $value = $filter['value'] ?? null;
    if ($value === null || $value === '') {
        return null;
    }

    // 4. Strip commas from numeric text searches
    if (is_string($value)) {
        $value = str_replace(',', '', $value);
    }

    // Build the query string based on type
    switch ($type) {
        case 'multi_select':
            $vals = is_array($value) ? $value : [$value];
            $escaped = array_map(fn($v) => '"' . addslashes($v) . '"', $vals);
            return "$field:(" . implode(' OR ', $escaped) . ")";

        case 'boolean':
            return "$field:" . ($value ? 'true' : 'false');

        case 'text':
        case 'text_search':
            // Quote the value to handle internal spaces, or use wildcards
            $escapedValue = addslashes($value);
            return "$field:*" . $escapedValue . "*";

        default:
            return "$field:\"" . addslashes((string)$value) . "\"";
    }
}

function executeDateCompare(string $solrUrl, array $params, array $dateCompare): array
{
    // Current period query
    $currentResult = json_decode(solrRequest($solrUrl . '/select', $params), true);

    // Build compare period params
    $compareParams = $params;
    $compareField  = $dateCompare['field'] ?? 'date_dt';
    $compareType   = $dateCompare['type']  ?? 'previous_period';
    $from = strtotime($dateCompare['from'] ?? '-30 days');
    $to   = strtotime($dateCompare['to']   ?? 'now');
    $diff = $to - $from;

    if ($compareType === 'previous_period') {
        $cFrom = date('Y-m-d\TH:i:s\Z', $from - $diff);
        $cTo   = date('Y-m-d\TH:i:s\Z', $from);
    } else { // same_period_last_year
        $cFrom = date('Y-m-d\TH:i:s\Z', strtotime('-1 year', $from));
        $cTo   = date('Y-m-d\TH:i:s\Z', strtotime('-1 year', $to));
    }

    $compareParams['fq'][] = "$compareField:[$cFrom TO $cTo]";
    $compareResult = json_decode(solrRequest($solrUrl . '/select', $compareParams), true);

    $currentTotal  = $currentResult['response']['numFound'] ?? 0;
    $compareTotal  = $compareResult['response']['numFound'] ?? 0;
    $absDiff       = $currentTotal - $compareTotal;
    $pctChange     = $compareTotal > 0
        ? round(($absDiff / $compareTotal) * 100, 2)
        : null;

    return [
        'current'    => ['total' => $currentTotal, 'docs' => $currentResult['response']['docs'] ?? []],
        'compare'    => ['total' => $compareTotal,  'docs' => $compareResult['response']['docs'] ?? []],
        'difference' => ['absolute' => $absDiff, 'percentage' => $pctChange],
    ];
}

// ── Solr Helpers ──────────────────────────────────────────────────────────────

function buildSolrQueryString(array $params): string
{
    $queryStringParts = [];
    foreach ($params as $key => $val) {
        if (is_array($val)) {
            // Solr expects multiple fq=... parameters, not fq[0]=...
            foreach ($val as $v) {
                $queryStringParts[] = urlencode($key) . '=' . urlencode($v);
            }
        } else {
            $queryStringParts[] = urlencode($key) . '=' . urlencode($val);
        }
    }
    return implode('&', $queryStringParts);
}

function solrRequest(string $url, array $params): string
{
    $ch = curl_init();
    $queryString = buildSolrQueryString($params);

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url . '?' . $queryString,
        CURLOPT_POST           => false, // Change to GET for simpler query string handling or use POST with built string
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);

    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) throw new RuntimeException("cURL error: $err");
    return $response;
}

function solrGet(string $url): string
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    return $resp;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function inferType(string $name): string
{
    if (str_ends_with($name, '_i')) return 'integer';
    if (str_ends_with($name, '_f')) return 'float';
    if (str_ends_with($name, '_b')) return 'boolean';
    if (str_ends_with($name, '_dt')) return 'date';
    if (str_ends_with($name, '_s')) return 'string';
    return 'string';
}

function formatLabel(string $name): string
{
    $name = preg_replace('/(_s|_i|_f|_b|_dt|_txt)$/', '', $name);
    $name = str_replace('_', ' ', $name);
    return ucwords($name);
}

function getBody(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function json(mixed $data): void
{
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
