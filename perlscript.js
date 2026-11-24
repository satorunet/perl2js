/* Legacy name. This project is now "Perl2JS": use perl2js.js
   (window.PerlScript and <script type="text/perlscript"> keep working as aliases). */
(function () {
  if (typeof module !== 'undefined' && module.exports) { module.exports = require('./perl2js.js'); return; }
  var s = document.currentScript, src = s && s.src ? s.src.replace(/perlscript\.js(\?.*)?$/, 'perl2js.js$1') : 'perl2js.js';
  document.write('<script src="' + src + '"><\/script>');
})();
