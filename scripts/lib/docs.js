export function localLinks(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
  return [...withoutCode.matchAll(/\]\(([^)]+)\)|(?:href|src)="([^"]+)"/g)]
    .map(match => (match[1] || match[2]).trim().replace(/^<|>$/g, ''))
    .filter(link => !/^(?:[a-z]+:|#|\/\/)/i.test(link))
    .map(link => decodeURIComponent(link.split('#')[0].split('?')[0])).filter(Boolean);
}
