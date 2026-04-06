"""One-off: README.md -> README.preview.html (GitHub-ish CSS + MathJax)."""
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
readme = (ROOT / "README.md").read_text(encoding="utf-8")
body = markdown.markdown(
    readme,
    extensions=["tables", "fenced_code", "nl2br"],
)
doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>README preview (GitHub-like)</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
<style>
.markdown-body {{ box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; }}
@media (max-width: 767px) {{ .markdown-body {{ padding: 15px; }} }}
</style>
<script>
window.MathJax = {{
  tex: {{ inlineMath: [['$', '$']], displayMath: [['$$', '$$']], processEscapes: true }}
}};
</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
<article class="markdown-body">
{body}
</article>
</body>
</html>
"""
out = ROOT / "README.preview.html"
out.write_text(doc, encoding="utf-8")
print(f"Wrote {out}")
