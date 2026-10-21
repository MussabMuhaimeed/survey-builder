<?php
// Starter templates for new surveys. Every text is written in both languages with T('es', 'en'):
// the primary language becomes the base text and, for bilingual surveys, the other one is stored
// as its translation, so templates arrive fully translated.

function T(string $es, string $en): array
{
    return ['__t' => true, 'es' => $es, 'en' => $en];
}

function tpl_id(string $prefix = 'b'): string
{
    return $prefix . '_' . random_id(8);
}

function tpl_opts(array $labels, array $images = []): array
{
    $out = [];
    foreach ($labels as $i => $l) {
        $o = ['id' => tpl_id('o'), 'label' => $l];
        if (isset($images[$i])) $o['image'] = $images[$i];
        $out[] = $o;
    }
    return $out;
}

function tpl_q(string $type, $title, array $extra = []): array
{
    return array_merge(['id' => tpl_id('q'), 'type' => $type, 'title' => $title, 'description' => '', 'required' => false], $extra);
}

function tpl_c(string $type, array $props): array
{
    return array_merge(['id' => tpl_id('b'), 'type' => $type], $props);
}

/** Resolves T() markers: primary text in place, the other language into ['tr'][$other] */
function tpl_finalize(array $node, string $primary, ?string $other): array
{
    foreach ($node as $k => $v) {
        if (is_array($v) && isset($v['__t'])) {
            $node[$k] = $v[$primary];
            if ($other && is_string($k)) $node['tr'][$other][$k] = $v[$other];
        } elseif (is_array($v)) {
            $node[$k] = tpl_finalize($v, $primary, $other);
        }
    }
    return $node;
}

function demo_logo(string $color1, string $color2, string $shape, string $name): string
{
    $shapes = [
        'circle'   => '<circle cx="40" cy="40" r="26" fill="url(#g)"/>',
        'square'   => '<rect x="16" y="16" width="48" height="48" rx="12" fill="url(#g)"/>',
        'triangle' => '<path d="M40 12 L68 64 H12 Z" fill="url(#g)"/>',
        'hex'      => '<path d="M40 12 L64 26 V54 L40 68 L16 54 V26 Z" fill="url(#g)"/>',
    ];
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        . '<stop offset="0" stop-color="' . $color1 . '"/><stop offset="1" stop-color="' . $color2 . '"/></linearGradient></defs>'
        . $shapes[$shape]
        . '<text x="80" y="50" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="#1f2937">' . $name . '</text></svg>';
    return 'data:image/svg+xml;base64,' . base64_encode($svg);
}

function survey_templates(): array
{
    return [
        'blank' => ['name' => __('En blanco'), 'desc' => __('Empieza desde cero con un lienzo vacío.'), 'icon' => 'ti-file-plus'],
        'nps'   => ['name' => __('Satisfacción de clientes'), 'desc' => __('NPS, valoración por estrellas y comentarios abiertos.'), 'icon' => 'ti-mood-smile'],
        'event' => ['name' => __('Feedback de evento'), 'desc' => __('Valoración de ponencias con matriz, sí/no y contacto.'), 'icon' => 'ti-calendar-event'],
        'logos' => ['name' => __('Votación de logos'), 'desc' => __('Elección visual entre logotipos y ranking de preferencias.'), 'icon' => 'ti-award'],
    ];
}

/**
 * @param string $lang 'es' | 'en' | 'es+en' | 'en+es' (bilingual: first one is the primary language)
 */
function build_template(string $key, string $title, string $lang = 'es'): array
{
    $parts = explode('+', $lang);
    $primary = $parts[0] === 'en' ? 'en' : 'es';
    $other = isset($parts[1]) && $parts[1] !== $primary && in_array($parts[1], ['es', 'en'], true) ? $parts[1] : null;

    $def = default_definition($title, $primary);
    $def['settings']['languages'] = $other ? [$primary, $other] : [$primary];
    $sid = fn() => tpl_id('s');

    $def['welcome']['text'] = T('Nos encantaría conocer tu opinión. Solo te llevará un par de minutos.', "We'd love to hear your opinion. It will only take a couple of minutes.");
    $def['thanks']['title'] = T('¡Muchas gracias!', 'Thank you very much!');
    $def['thanks']['text'] = T('Tus respuestas se han registrado correctamente.', 'Your answers have been recorded.');

    switch ($key) {
        case 'nps':
            $def['settings']['theme'] = 'oceano';
            $def['welcome']['text'] = T('Ayúdanos a mejorar. Responder te llevará menos de 2 minutos.', 'Help us improve. It will take you less than 2 minutes.');
            $def['steps'] = [
                ['id' => $sid(), 'title' => T('Tu experiencia', 'Your experience'), 'blocks' => [
                    tpl_c('heading', ['text' => T('Tu experiencia con nosotros', 'Your experience with us'), 'size' => 'h2', 'align' => 'left']),
                    tpl_q('nps', T('¿Qué probabilidad hay de que nos recomiendes a un amigo o colega?', 'How likely are you to recommend us to a friend or colleague?'), ['required' => true, 'minLabel' => T('Nada probable', 'Not at all likely'), 'maxLabel' => T('Muy probable', 'Extremely likely')]),
                    tpl_q('rating', T('¿Cómo valorarías la atención recibida?', 'How would you rate the service you received?'), ['max' => 5, 'icon' => 'star', 'required' => true]),
                    tpl_q('single_choice', T('¿Con qué frecuencia utilizas nuestros servicios?', 'How often do you use our services?'), ['options' => tpl_opts([T('A diario', 'Daily'), T('Semanalmente', 'Weekly'), T('Mensualmente', 'Monthly'), T('Ocasionalmente', 'Occasionally')]), 'allowOther' => false, 'otherLabel' => T('Otro', 'Other')]),
                ]],
                ['id' => $sid(), 'title' => T('Mejoras', 'Improvements'), 'blocks' => [
                    tpl_q('multiple_choice', T('¿Qué aspectos valoras más?', 'What do you value the most?'), ['options' => tpl_opts([T('Precio', 'Price'), T('Calidad', 'Quality'), T('Rapidez', 'Speed'), T('Atención al cliente', 'Customer service'), T('Facilidad de uso', 'Ease of use')]), 'allowOther' => true, 'otherLabel' => T('Otro', 'Other'), 'minSelect' => 0, 'maxSelect' => 3, 'description' => T('Elige hasta 3 opciones', 'Choose up to 3 options')]),
                    tpl_q('long_text', T('¿Qué podríamos mejorar?', 'What could we improve?'), ['placeholder' => T('Cuéntanos con total libertad…', 'Feel free to tell us anything…')]),
                ]],
            ];
            break;

        case 'event':
            $def['settings']['theme'] = 'atardecer';
            $def['steps'] = [
                ['id' => $sid(), 'title' => T('Valoración', 'Rating'), 'blocks' => [
                    tpl_c('paragraph', ['text' => T('Gracias por asistir. Tu opinión nos ayuda a preparar **la próxima edición**.', 'Thanks for coming. Your feedback helps us prepare **the next edition**.'), 'align' => 'left']),
                    tpl_q('rating', T('Valoración general del evento', 'Overall rating of the event'), ['max' => 5, 'icon' => 'star', 'required' => true]),
                    tpl_q('matrix', T('Valora cada aspecto del evento', 'Rate each aspect of the event'), [
                        'rows' => tpl_opts([T('Ponencias', 'Talks'), T('Organización', 'Organisation'), T('Lugar', 'Venue'), T('Catering', 'Catering')]),
                        'columns' => tpl_opts([T('Malo', 'Poor'), T('Regular', 'Fair'), T('Bueno', 'Good'), T('Excelente', 'Excellent')]),
                        'required' => true,
                    ]),
                ]],
                ['id' => $sid(), 'title' => T('Próxima edición', 'Next edition'), 'blocks' => [
                    tpl_q('yes_no', T('¿Asistirías a la próxima edición?', 'Would you attend the next edition?'), ['yesLabel' => T('Sí, seguro', 'Yes, definitely'), 'noLabel' => T('Probablemente no', 'Probably not'), 'required' => true]),
                    tpl_q('scale', T('¿Cuánto has aprendido?', 'How much did you learn?'), ['min' => 1, 'max' => 5, 'minLabel' => T('Poco', 'A little'), 'maxLabel' => T('Muchísimo', 'A lot')]),
                    tpl_q('long_text', T('¿Qué temas te gustaría ver?', 'Which topics would you like to see?'), ['placeholder' => T('Ideas, ponentes, formatos…', 'Ideas, speakers, formats…')]),
                    tpl_q('email', T('Déjanos tu email si quieres recibir novedades', 'Leave your email if you want to receive news'), ['placeholder' => T('nombre@empresa.com', 'name@company.com')]),
                ]],
            ];
            break;

        case 'logos':
            $def['settings']['theme'] = 'rosa';
            $logos = [
                demo_logo('#8b5cf6', '#ec4899', 'circle', 'Nova'),
                demo_logo('#0ea5e9', '#22c55e', 'square', 'Brisa'),
                demo_logo('#f97316', '#eab308', 'triangle', 'Cumbre'),
                demo_logo('#111827', '#6b7280', 'hex', 'Forja'),
            ];
            $labels = fn() => [T('Propuesta A · Nova', 'Proposal A · Nova'), T('Propuesta B · Brisa', 'Proposal B · Brisa'), T('Propuesta C · Cumbre', 'Proposal C · Cumbre'), T('Propuesta D · Forja', 'Proposal D · Forja')];
            $def['welcome']['text'] = T('Estamos renovando nuestra imagen y queremos que elijas con nosotros.', "We're refreshing our brand and we want you to choose with us.");
            $def['steps'] = [
                ['id' => $sid(), 'title' => T('Tu favorito', 'Your favourite'), 'blocks' => [
                    tpl_c('heading', ['text' => T('Elige tu logo favorito', 'Choose your favourite logo'), 'size' => 'h2', 'align' => 'center']),
                    tpl_q('image_choice', T('¿Qué logo representa mejor a la marca?', 'Which logo best represents the brand?'), ['options' => tpl_opts($labels(), $logos), 'multiple' => false, 'columns' => 2, 'showLabels' => true, 'required' => true]),
                    tpl_q('image_choice', T('¿Cuáles descartarías? (puedes elegir varios)', 'Which ones would you discard? (you can choose several)'), ['options' => tpl_opts($labels(), $logos), 'multiple' => true, 'columns' => 2, 'showLabels' => true, 'maxSelect' => 0]),
                ]],
                ['id' => $sid(), 'title' => T('Ranking', 'Ranking'), 'blocks' => [
                    tpl_q('ranking', T('Ordena las propuestas de más a menos preferida', 'Sort the proposals from most to least preferred'), ['options' => tpl_opts($labels()), 'required' => true, 'description' => T('Arrastra o usa las flechas', 'Drag or use the arrows')]),
                    tpl_q('short_text', T('¿Por qué elegiste tu favorito?', 'Why did you choose your favourite?'), ['placeholder' => T('En pocas palabras…', 'In a few words…')]),
                ]],
            ];
            break;

        default:
            $def['steps'][0]['title'] = T('Paso 1', 'Step 1');
            $def['steps'][0]['blocks'] = [
                tpl_q('short_text', T('¿Cuál es tu nombre?', 'What is your name?'), ['placeholder' => T('Tu respuesta', 'Your answer')]),
            ];
    }
    return tpl_finalize($def, $primary, $other);
}
