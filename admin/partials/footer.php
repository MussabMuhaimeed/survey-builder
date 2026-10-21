<div id="toast-root" class="toast-root" aria-live="polite"></div>
<script>window.APP = { base: <?= json_for_script(base_path()) ?>, csrf: <?= json_for_script(csrf_token()) ?> };</script>
<script src="<?= url('assets/js/admin.js') ?>?v=<?= APP_VERSION ?>"></script>
<?= $extraFoot ?? '' ?>
</body>
</html>
