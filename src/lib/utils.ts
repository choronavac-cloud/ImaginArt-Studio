import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import html2canvas from "html2canvas"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function sanitizedHtml2Canvas(element: HTMLElement, options: any): Promise<HTMLCanvasElement> {
  const originalGetComputedStyle = window.getComputedStyle;
  
  // Wrap getComputedStyle with a Proxy to intercept and sanitize colors dynamically
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            if (val && (val.includes('oklch') || val.includes('oklab'))) {
              return sanitizeColors(val);
            }
            return val;
          };
        }
        
        const val = Reflect.get(target, prop);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
          return sanitizeColors(val);
        }
        return val;
      }
    });
  };

  try {
    const canvas = await html2canvas(element, options);
    return canvas;
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

export function oklchToRgba(oklchStr: string): string {
  try {
    const matches = oklchStr.match(/oklch\s*\(([^)]+)\)/i);
    if (!matches) return oklchStr;
    
    const content = matches[1];
    const [colorPart, alphaPart] = content.split('/');
    const parts = colorPart.trim().split(/[\s,]+/);
    if (parts.length < 3) return oklchStr;
    
    const L_str = parts[0];
    const C_str = parts[1];
    const H_str = parts[2];
    
    let l = L_str.endsWith('%') ? parseFloat(L_str) / 100 : parseFloat(L_str);
    let c = parseFloat(C_str);
    let h = parseFloat(H_str);
    
    if (isNaN(l) || isNaN(c) || isNaN(h)) return oklchStr;
    
    let a = 1;
    if (alphaPart) {
      const a_trimmed = alphaPart.trim();
      a = a_trimmed.endsWith('%') ? parseFloat(a_trimmed) / 100 : parseFloat(a_trimmed);
      if (isNaN(a)) a = 1;
    }
    
    // Convert LCH to Lab
    const hRad = (h * Math.PI) / 180;
    const lab_a = c * Math.cos(hRad);
    const lab_b = c * Math.sin(hRad);
    
    // Convert OKLab to LMS
    const l_lms = l + 0.3963377774 * lab_a + 0.2158037573 * lab_b;
    const m_lms = l - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
    const s_lms = l - 0.0894841775 * lab_a - 1.2914855480 * lab_b;
    
    // Cube LMS
    const l_cube = l_lms * l_lms * l_lms;
    const m_cube = m_lms * m_lms * m_lms;
    const s_cube = s_lms * s_lms * s_lms;
    
    // LMS to linear sRGB
    const r_lin = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
    const g_lin = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
    const b_lin = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
    
    // Helper to gamma correct and clamp
    const transform = (x: number) => {
      const clamped = Math.max(0, Math.min(1, x));
      return clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(transform(r_lin) * 255);
    const g = Math.round(transform(g_lin) * 255);
    const b = Math.round(transform(b_lin) * 255);
    
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch (e) {
    return oklchStr;
  }
}

export function oklabToRgba(oklabStr: string): string {
  try {
    const realMatches = oklabStr.match(/oklab\s*\(([^)]+)\)/i);
    if (!realMatches) return oklabStr;
    
    const content = realMatches[1];
    const [colorPart, alphaPart] = content.split('/');
    const parts = colorPart.trim().split(/[\s,]+/);
    if (parts.length < 3) return oklabStr;
    
    const L_str = parts[0];
    const A_str = parts[1];
    const B_str = parts[2];
    
    let l = L_str.endsWith('%') ? parseFloat(L_str) / 100 : parseFloat(L_str);
    let lab_a = A_str.endsWith('%') ? parseFloat(A_str) / 100 : parseFloat(A_str);
    let lab_b = B_str.endsWith('%') ? parseFloat(B_str) / 100 : parseFloat(B_str);
    
    if (isNaN(l) || isNaN(lab_a) || isNaN(lab_b)) return oklabStr;
    
    let a = 1;
    if (alphaPart) {
      const a_trimmed = alphaPart.trim();
      a = a_trimmed.endsWith('%') ? parseFloat(a_trimmed) / 100 : parseFloat(a_trimmed);
      if (isNaN(a)) a = 1;
    }
    
    // Convert OKLab to LMS
    const l_lms = l + 0.3963377774 * lab_a + 0.2158037573 * lab_b;
    const m_lms = l - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
    const s_lms = l - 0.0894841775 * lab_a - 1.2914855480 * lab_b;
    
    // Cube LMS
    const l_cube = l_lms * l_lms * l_lms;
    const m_cube = m_lms * m_lms * m_lms;
    const s_cube = s_lms * s_lms * s_lms;
    
    // LMS to linear sRGB
    const r_lin = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
    const g_lin = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
    const b_lin = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
    
    // Helper to gamma correct and clamp
    const transform = (x: number) => {
      const clamped = Math.max(0, Math.min(1, x));
      return clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(transform(r_lin) * 255);
    const g = Math.round(transform(g_lin) * 255);
    const b = Math.round(transform(b_lin) * 255);
    
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch (e) {
    return oklabStr;
  }
}

export function sanitizeColors(text: string): string {
  if (!text) return text;
  let result = text;
  if (result.includes("oklch")) {
    result = result.replace(/oklch\s*\([^)]+\)/gi, (match) => oklchToRgba(match));
  }
  if (result.includes("oklab")) {
    result = result.replace(/oklab\s*\([^)]+\)/gi, (match) => oklabToRgba(match));
  }
  return result;
}

export function sanitizeHtml2CanvasDoc(doc: Document) {
  // Convert existing style tags
  try {
    doc.querySelectorAll("style").forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes("oklch") || styleTag.textContent.includes("oklab"))) {
        styleTag.textContent = sanitizeColors(styleTag.textContent);
      }
    });
  } catch (e) {
    // Ignored
  }

  // Convert inline style attributes
  try {
    const walkAndSanitizeInlineStyles = (element: Element) => {
      const styleAttr = element.getAttribute("style");
      if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
        const sanitized = sanitizeColors(styleAttr);
        element.setAttribute("style", sanitized);
      }
      for (let i = 0; i < element.children.length; i++) {
        walkAndSanitizeInlineStyles(element.children[i]);
      }
    };
    if (doc.body) {
      walkAndSanitizeInlineStyles(doc.body);
    }
  } catch (err) {
    console.warn("Could not sanitize inline elements:", err);
  }

  // Copy CSSOM stylesheets and sanitize their rules before parsing
  try {
    const mainStyleSheets = Array.from(window.document.styleSheets);
    mainStyleSheets.forEach((sheet) => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          let cssText = "";
          for (let i = 0; i < rules.length; i++) {
            cssText += rules[i].cssText + "\n";
          }
          if (cssText.includes("oklch") || cssText.includes("oklab")) {
            cssText = sanitizeColors(cssText);
          }
          const styleTag = doc.createElement("style");
          styleTag.textContent = cssText;
          doc.head.appendChild(styleTag);
        }
      } catch (err) {
        // Ignored if cross-origin
      }
    });

    // Remove link links to avoid fetching un-sanitized files
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      try {
        link.remove();
      } catch {
        // Ignored
      }
    });
  } catch (err) {
    console.error("Failed to copy and sanitize style sheets:", err);
  }
}
