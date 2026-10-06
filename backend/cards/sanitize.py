"""Очистка HTML описания карточки от скриптов и опасных атрибутов."""
import bleach

ALLOWED_TAGS = [
    "p", "br", "hr", "div", "span",
    "b", "strong", "i", "em", "u", "s", "sub", "sup", "mark",
    "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "a",
]
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "th": ["colspan", "rowspan"],
    "td": ["colspan", "rowspan"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(html: str) -> str:
    return bleach.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
