<?php
// Loading, aggregation and export of results (always shown in the survey's primary language)

const CHOICE_TYPES = ['single_choice', 'multiple_choice', 'dropdown', 'image_choice', 'yes_no'];
const NUMERIC_TYPES = ['rating', 'scale', 'nps', 'slider', 'number'];
const TEXT_TYPES = ['short_text', 'long_text', 'email', 'date'];

/** Devuelve [responses, answers[response_id][question_id] = ['v' => mixed, 'o' => ?string]] */
function results_load(array $s, ?string $from = null, ?string $to = null): array
{
    $where = 'r.survey_id = ?';
    $p = [$s['id']];
    if ($from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) { $where .= ' AND r.created_at >= ?'; $p[] = $from . ' 00:00:00'; }
    if ($to && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) { $where .= ' AND r.created_at <= ?'; $p[] = $to . ' 23:59:59'; }

    $responses = q("SELECT r.id, r.created_at, r.duration_sec, " . (has_lang_column() ? 'r.lang' : 'NULL AS lang') . " FROM responses r WHERE $where ORDER BY r.created_at DESC", $p)->fetchAll();
    $answers = [];
    $st = q("SELECT a.response_id, a.question_id, a.value, a.other_text FROM answers a JOIN responses r ON r.id = a.response_id WHERE $where", $p);
    while ($row = $st->fetch()) {
        $answers[(int) $row['response_id']][$row['question_id']] = [
            'v' => json_decode((string) $row['value'], true),
            'o' => $row['other_text'],
        ];
    }
    return [$responses, $answers];
}

function option_map(array $q): array
{
    if (($q['type'] ?? '') === 'yes_no') {
        return ['yes' => ['id' => 'yes', 'label' => ($q['yesLabel'] ?? '') ?: __('Sí')], 'no' => ['id' => 'no', 'label' => ($q['noLabel'] ?? '') ?: __('No')]];
    }
    $m = [];
    foreach ($q['options'] ?? [] as $o) $m[$o['id']] = $o;
    return $m;
}

function num_range(array $q): array
{
    switch ($q['type']) {
        case 'rating': return [1, max(3, (int) ($q['max'] ?? 5)), 1];
        case 'scale':  return [(int) ($q['min'] ?? 1), (int) ($q['max'] ?? 5), 1];
        case 'nps':    return [0, 10, 1];
        case 'slider': return [(float) ($q['min'] ?? 0), (float) ($q['max'] ?? 100), max(0.0001, (float) ($q['step'] ?? 1))];
    }
    return [null, null, null];
}

function results_aggregate(array $def, array $responses, array $answers): array
{
    $out = [];
    $total = count($responses);
    $dateOf = [];
    foreach ($responses as $r) $dateOf[(int) $r['id']] = $r['created_at'];

    foreach (survey_questions($def) as $qid => $q) {
        $vals = [];
        foreach ($answers as $rid => $map) {
            if (isset($map[$qid]) && $map[$qid]['v'] !== null && $map[$qid]['v'] !== '' && $map[$qid]['v'] !== []) {
                $vals[] = ['rid' => $rid, 'v' => $map[$qid]['v'], 'o' => $map[$qid]['o']];
            }
        }
        $n = count($vals);
        $stat = ['id' => $qid, 'type' => $q['type'], 'title' => $q['title'] ?? '', 'answered' => $n, 'total' => $total];

        if (in_array($q['type'], CHOICE_TYPES, true)) {
            $opts = option_map($q);
            $counts = array_fill_keys(array_keys($opts), 0);
            $others = [];
            $multi = $q['type'] === 'multiple_choice' || ($q['type'] === 'image_choice' && !empty($q['multiple']));
            foreach ($vals as $a) {
                foreach ((array) $a['v'] as $sel) {
                    $sel = (string) $sel;
                    if ($sel === '__other__') { $others[] = ['text' => (string) $a['o'], 'date' => $dateOf[$a['rid']] ?? null]; continue; }
                    if (isset($counts[$sel])) $counts[$sel]++;
                }
            }
            $list = [];
            foreach ($opts as $id => $o) {
                $list[] = ['id' => $id, 'label' => $o['label'] ?? '', 'image' => $o['image'] ?? '', 'count' => $counts[$id], 'pct' => $n ? round($counts[$id] / $n * 100, 1) : 0];
            }
            if (!empty($q['allowOther']) || $others) {
                $list[] = ['id' => '__other__', 'label' => ($q['otherLabel'] ?? '') ?: __('Otro'), 'image' => '', 'count' => count($others), 'pct' => $n ? round(count($others) / $n * 100, 1) : 0];
            }
            $stat['multi'] = $multi;
            $stat['options'] = $list;
            $stat['others'] = array_slice(array_reverse($others), 0, 200);
        } elseif (in_array($q['type'], NUMERIC_TYPES, true)) {
            $nums = array_map(fn($a) => (float) $a['v'], array_filter($vals, fn($a) => is_numeric($a['v'])));
            sort($nums);
            $c = count($nums);
            $stat['avg'] = $c ? round(array_sum($nums) / $c, 2) : null;
            $stat['min'] = $c ? $nums[0] : null;
            $stat['max'] = $c ? $nums[$c - 1] : null;
            $stat['median'] = $c ? ($c % 2 ? $nums[intdiv($c, 2)] : ($nums[$c / 2 - 1] + $nums[$c / 2]) / 2) : null;

            [$lo, $hi, $step] = num_range($q);
            $dist = [];
            if ($lo !== null && ($hi - $lo) / $step <= 20) {
                for ($v = $lo; $v <= $hi + 1e-9; $v += $step) $dist[(string) round($v, 4)] = 0;
                foreach ($nums as $v) {
                    $k = (string) round($lo + round(($v - $lo) / $step) * $step, 4);
                    if (isset($dist[$k])) $dist[$k]++;
                }
            } elseif ($c) {
                $lo = $lo ?? $nums[0];
                $hi = $hi ?? $nums[$c - 1];
                $buckets = 10;
                $w = ($hi - $lo) / $buckets ?: 1;
                for ($i = 0; $i < $buckets; $i++) $dist[round($lo + $i * $w, 2) . '–' . round($lo + ($i + 1) * $w, 2)] = 0;
                $keys = array_keys($dist);
                foreach ($nums as $v) {
                    $i = min($buckets - 1, max(0, (int) floor(($v - $lo) / $w)));
                    $dist[$keys[$i]]++;
                }
            }
            $stat['dist'] = $dist;
            if ($q['type'] === 'nps') {
                $pro = count(array_filter($nums, fn($v) => $v >= 9));
                $det = count(array_filter($nums, fn($v) => $v <= 6));
                $pas = $c - $pro - $det;
                $stat['nps'] = [
                    'score' => $c ? (int) round(($pro - $det) / $c * 100) : null,
                    'promoters' => $pro, 'passives' => $pas, 'detractors' => $det,
                ];
            }
            if ($q['type'] === 'rating') { $stat['scaleMax'] = (int) ($q['max'] ?? 5); $stat['icon'] = $q['icon'] ?? 'star'; }
            if ($q['type'] === 'slider') $stat['unit'] = $q['unit'] ?? '';
            if ($q['type'] === 'scale') { $stat['minLabel'] = $q['minLabel'] ?? ''; $stat['maxLabel'] = $q['maxLabel'] ?? ''; }
        } elseif ($q['type'] === 'ranking') {
            $opts = option_map($q);
            $k = count($opts);
            $sum = array_fill_keys(array_keys($opts), 0);
            $cnt = array_fill_keys(array_keys($opts), 0);
            $first = array_fill_keys(array_keys($opts), 0);
            foreach ($vals as $a) {
                foreach (array_values((array) $a['v']) as $pos => $oid) {
                    if (!isset($sum[$oid])) continue;
                    $sum[$oid] += $pos + 1;
                    $cnt[$oid]++;
                    if ($pos === 0) $first[$oid]++;
                }
            }
            $list = [];
            foreach ($opts as $id => $o) {
                $avg = $cnt[$id] ? $sum[$id] / $cnt[$id] : null;
                $list[] = [
                    'id' => $id, 'label' => $o['label'] ?? '', 'avg' => $avg !== null ? round($avg, 2) : null,
                    'firsts' => $first[$id], 'score' => $avg !== null && $k > 1 ? round(($k - $avg) / ($k - 1) * 100, 1) : 0,
                ];
            }
            usort($list, fn($a, $b) => ($a['avg'] ?? 99) <=> ($b['avg'] ?? 99));
            $stat['options'] = $list;
        } elseif ($q['type'] === 'matrix') {
            $rows = $q['rows'] ?? [];
            $cols = $q['columns'] ?? [];
            $grid = [];
            foreach ($rows as $r) $grid[$r['id']] = array_fill_keys(array_column($cols, 'id'), 0);
            foreach ($vals as $a) {
                foreach ((array) $a['v'] as $rid => $cid) {
                    if (isset($grid[$rid][$cid])) $grid[$rid][$cid]++;
                }
            }
            $stat['rows'] = array_map(fn($r) => ['id' => $r['id'], 'label' => $r['label']], $rows);
            $stat['columns'] = array_map(fn($c) => ['id' => $c['id'], 'label' => $c['label']], $cols);
            $stat['grid'] = $grid;
        } else {
            $texts = [];
            foreach ($vals as $a) $texts[] = ['text' => is_scalar($a['v']) ? (string) $a['v'] : json_encode($a['v']), 'date' => $dateOf[$a['rid']] ?? null];
            usort($texts, fn($a, $b) => strcmp((string) $b['date'], (string) $a['date']));
            $stat['texts'] = array_slice($texts, 0, 300);
            if ($q['type'] === 'date') {
                $byDate = [];
                foreach ($texts as $t) $byDate[$t['text']] = ($byDate[$t['text']] ?? 0) + 1;
                arsort($byDate);
                $stat['top'] = array_slice($byDate, 0, 10, true);
            }
        }
        $out[] = $stat;
    }
    return $out;
}

/** Representación legible de una respuesta */
function answer_text(array $q, $v, ?string $other): string
{
    if ($v === null || $v === '' || $v === []) return '';
    $type = $q['type'];
    if (in_array($type, CHOICE_TYPES, true)) {
        $opts = option_map($q);
        $parts = [];
        foreach ((array) $v as $sel) {
            if ($sel === '__other__') $parts[] = (($q['otherLabel'] ?? '') ?: __('Otro')) . ': ' . (string) $other;
            else $parts[] = $opts[$sel]['label'] ?? (string) $sel;
        }
        return implode(', ', $parts);
    }
    if ($type === 'ranking') {
        $opts = option_map($q);
        $parts = [];
        foreach (array_values((array) $v) as $i => $oid) $parts[] = ($i + 1) . '. ' . ($opts[$oid]['label'] ?? $oid);
        return implode(' | ', $parts);
    }
    if ($type === 'matrix') {
        $rows = array_column($q['rows'] ?? [], 'label', 'id');
        $cols = array_column($q['columns'] ?? [], 'label', 'id');
        $parts = [];
        foreach ((array) $v as $rid => $cid) $parts[] = ($rows[$rid] ?? $rid) . ': ' . ($cols[$cid] ?? $cid);
        return implode('; ', $parts);
    }
    if ($type === 'slider' && !empty($q['unit'])) return $v . ' ' . $q['unit'];
    return is_scalar($v) ? (string) $v : json_encode($v, JSON_UNESCAPED_UNICODE);
}

/** Evita la inyección de fórmulas al abrir el CSV en Excel */
function csv_safe($v): string
{
    $v = (string) $v;
    return ($v !== '' && strpos('=+-@', $v[0]) !== false && !is_numeric($v)) ? "'" . $v : $v;
}

function export_csv(array $s): void
{
    [$responses, $answers] = results_load($s, $_GET['from'] ?? null, $_GET['to'] ?? null);
    $qs = survey_questions($s['def']);

    $filename = preg_replace('/[^a-z0-9]+/i', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s['title']) ?: 'encuesta');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . trim(strtolower($filename), '-') . '-' . date('Ymd') . '.csv"');
    $fh = fopen('php://output', 'w');
    fwrite($fh, "\xEF\xBB\xBF");

    $L = survey_langs($s['def']);
    $head = ['ID', __('Fecha'), __('Duración (s)')];
    if ($L['bilingual']) $head[] = __('Idioma');
    foreach ($qs as $q) {
        if ($q['type'] === 'matrix') {
            foreach ($q['rows'] ?? [] as $r) $head[] = ($q['title'] ?? '') . ' — ' . $r['label'];
        } else {
            $head[] = $q['title'] ?? $q['id'];
        }
    }
    fputcsv($fh, $head, ';');

    foreach (array_reverse($responses) as $r) {
        $row = [$r['id'], $r['created_at'], $r['duration_sec']];
        if ($L['bilingual']) $row[] = strtoupper((string) ($r['lang'] ?? ''));
        $map = $answers[(int) $r['id']] ?? [];
        foreach ($qs as $qid => $q) {
            $a = $map[$qid] ?? null;
            if ($q['type'] === 'matrix') {
                $cols = array_column($q['columns'] ?? [], 'label', 'id');
                foreach ($q['rows'] ?? [] as $mr) {
                    $cid = is_array($a['v'] ?? null) ? ($a['v'][$mr['id']] ?? null) : null;
                    $row[] = $cid !== null ? ($cols[$cid] ?? $cid) : '';
                }
            } else {
                $row[] = $a ? answer_text($q, $a['v'], $a['o']) : '';
            }
        }
        fputcsv($fh, array_map('csv_safe', $row), ';');
    }
    fclose($fh);
}
