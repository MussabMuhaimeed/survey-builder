<?php
// Plantillas de partida para nuevas encuestas

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

function tpl_q(string $type, string $title, array $extra = []): array
{
    return array_merge(['id' => tpl_id('q'), 'type' => $type, 'title' => $title, 'description' => '', 'required' => false], $extra);
}

function tpl_c(string $type, array $props): array
{
    return array_merge(['id' => tpl_id('b'), 'type' => $type], $props);
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
        'blank' => [
            'name' => 'En blanco',
            'desc' => 'Empieza desde cero con un lienzo vacío.',
            'icon' => 'ti-file-plus',
        ],
        'nps' => [
            'name' => 'Satisfacción de clientes',
            'desc' => 'NPS, valoración por estrellas y comentarios abiertos.',
            'icon' => 'ti-mood-smile',
        ],
        'event' => [
            'name' => 'Feedback de evento',
            'desc' => 'Valoración de ponencias con matriz, sí/no y contacto.',
            'icon' => 'ti-calendar-event',
        ],
        'logos' => [
            'name' => 'Votación de logos',
            'desc' => 'Elección visual entre logotipos y ranking de preferencias.',
            'icon' => 'ti-award',
        ],
    ];
}

function build_template(string $key, string $title): array
{
    $def = default_definition($title);
    $sid = fn() => tpl_id('s');

    switch ($key) {
        case 'nps':
            $def['settings']['theme'] = 'oceano';
            $def['welcome']['text'] = 'Ayúdanos a mejorar. Responder te llevará menos de 2 minutos.';
            $def['steps'] = [
                ['id' => $sid(), 'title' => 'Tu experiencia', 'blocks' => [
                    tpl_c('heading', ['text' => 'Tu experiencia con nosotros', 'size' => 'h2', 'align' => 'left']),
                    tpl_q('nps', '¿Qué probabilidad hay de que nos recomiendes a un amigo o colega?', ['required' => true, 'minLabel' => 'Nada probable', 'maxLabel' => 'Muy probable']),
                    tpl_q('rating', '¿Cómo valorarías la atención recibida?', ['max' => 5, 'icon' => 'star', 'required' => true]),
                    tpl_q('single_choice', '¿Con qué frecuencia utilizas nuestros servicios?', ['options' => tpl_opts(['A diario', 'Semanalmente', 'Mensualmente', 'Ocasionalmente']), 'allowOther' => false]),
                ]],
                ['id' => $sid(), 'title' => 'Mejoras', 'blocks' => [
                    tpl_q('multiple_choice', '¿Qué aspectos valoras más?', ['options' => tpl_opts(['Precio', 'Calidad', 'Rapidez', 'Atención al cliente', 'Facilidad de uso']), 'allowOther' => true, 'minSelect' => 0, 'maxSelect' => 3, 'description' => 'Elige hasta 3 opciones']),
                    tpl_q('long_text', '¿Qué podríamos mejorar?', ['placeholder' => 'Cuéntanos con total libertad…']),
                ]],
            ];
            break;

        case 'event':
            $def['settings']['theme'] = 'atardecer';
            $def['steps'] = [
                ['id' => $sid(), 'title' => 'Valoración', 'blocks' => [
                    tpl_c('paragraph', ['text' => 'Gracias por asistir. Tu opinión nos ayuda a preparar **la próxima edición**.', 'align' => 'left']),
                    tpl_q('rating', 'Valoración general del evento', ['max' => 5, 'icon' => 'star', 'required' => true]),
                    tpl_q('matrix', 'Valora cada aspecto del evento', [
                        'rows' => tpl_opts(['Ponencias', 'Organización', 'Lugar', 'Catering']),
                        'columns' => tpl_opts(['Malo', 'Regular', 'Bueno', 'Excelente']),
                        'required' => true,
                    ]),
                ]],
                ['id' => $sid(), 'title' => 'Próxima edición', 'blocks' => [
                    tpl_q('yes_no', '¿Asistirías a la próxima edición?', ['yesLabel' => 'Sí, seguro', 'noLabel' => 'Probablemente no', 'required' => true]),
                    tpl_q('scale', '¿Cuánto has aprendido?', ['min' => 1, 'max' => 5, 'minLabel' => 'Poco', 'maxLabel' => 'Muchísimo']),
                    tpl_q('long_text', '¿Qué temas te gustaría ver?', ['placeholder' => 'Ideas, ponentes, formatos…']),
                    tpl_q('email', 'Déjanos tu email si quieres recibir novedades', ['placeholder' => 'nombre@empresa.com']),
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
            $labels = ['Propuesta A · Nova', 'Propuesta B · Brisa', 'Propuesta C · Cumbre', 'Propuesta D · Forja'];
            $def['welcome']['text'] = 'Estamos renovando nuestra imagen y queremos que elijas con nosotros.';
            $def['steps'] = [
                ['id' => $sid(), 'title' => 'Tu favorito', 'blocks' => [
                    tpl_c('heading', ['text' => 'Elige tu logo favorito', 'size' => 'h2', 'align' => 'center']),
                    tpl_q('image_choice', '¿Qué logo representa mejor a la marca?', ['options' => tpl_opts($labels, $logos), 'multiple' => false, 'columns' => 2, 'showLabels' => true, 'required' => true]),
                    tpl_q('image_choice', '¿Cuáles descartarías? (puedes elegir varios)', ['options' => tpl_opts($labels, $logos), 'multiple' => true, 'columns' => 2, 'showLabels' => true, 'maxSelect' => 0]),
                ]],
                ['id' => $sid(), 'title' => 'Ranking', 'blocks' => [
                    tpl_q('ranking', 'Ordena las propuestas de más a menos preferida', ['options' => tpl_opts($labels), 'required' => true, 'description' => 'Arrastra o usa las flechas']),
                    tpl_q('short_text', '¿Por qué elegiste tu favorito?', ['placeholder' => 'En pocas palabras…']),
                ]],
            ];
            break;

        default:
            $def['steps'][0]['blocks'] = [
                tpl_q('short_text', '¿Cuál es tu nombre?', ['placeholder' => 'Tu respuesta']),
            ];
    }
    return $def;
}
