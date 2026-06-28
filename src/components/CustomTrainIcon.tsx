import React from 'react';
import { Train } from 'lucide-react';

interface CustomTrainIconProps {
  className?: string;
  size?: number | string;
  customIcon?: string | null;
  customIconType?: 'svg' | 'image' | null;
  useThemeColor?: boolean;
}

/**
 * CustomTrainIcon component.
 * Allows the app to "assemble" a custom user icon to function like a native Lucide icon.
 * If SVG text is provided, it's rendered inline to support CSS styling (colors, sizing).
 */
export const CustomTrainIcon: React.FC<CustomTrainIconProps> = ({ 
  className = '', 
  size = 24, 
  customIcon,
  customIconType = 'svg',
  useThemeColor = false
}) => {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);
  const [viewBox, setViewBox] = React.useState<string>('0 0 1024 1024');

  React.useEffect(() => {
    if (customIcon && customIconType === 'svg') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(customIcon, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        
        if (svgElement) {
          // If the user wants the app theme colors, we recursively handle elements
          if (useThemeColor) {
            // Remove internal style blocks to prevent CSS classes from overriding our dynamic theming
            svgElement.querySelectorAll('style').forEach(s => s.remove());

            const allElements = svgElement.querySelectorAll('*');
            
            const isWhiteValue = (val: string | null | undefined) => {
              if (!val) return false;
              const v = val.toLowerCase().trim();
              if (v === 'none' || v === 'transparent') return false;

              // Check for exact matches and off-whites frequently found in exports
              const commonWhites = ['#fff', '#ffffff', '#fefffe', '#fdfdfd', '#fafafa', '#f5f5f5', 'white'];
              if (commonWhites.includes(v)) return true;
              if (v.includes('255,255,255')) return true;

              // Hex brightness heuristic
              if (v.startsWith('#')) {
                const hex = v.replace('#', '');
                try {
                  if (hex.length === 3 || hex.length === 6) {
                    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
                    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
                    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
                    return r > 240 && g > 240 && b > 240;
                  }
                } catch (e) { return false; }
              }
              return false;
            };

            allElements.forEach(el => {
              const svgEl = el as SVGElement;
              const fill = svgEl.getAttribute('fill');
              const stroke = svgEl.getAttribute('stroke');
              const style = svgEl.getAttribute('style');
              
              // Parse style for inline colors
              let styleFill = null;
              let styleStroke = null;
              if (style) {
                const fillMatch = style.match(/fill:\s*([^; ]+)/i);
                const strokeMatch = style.match(/stroke:\s*([^; ]+)/i);
                if (fillMatch) styleFill = fillMatch[1];
                if (strokeMatch) styleStroke = strokeMatch[1];
              }

              if (isWhiteValue(fill) || isWhiteValue(stroke) || isWhiteValue(styleFill) || isWhiteValue(styleStroke)) {
                // Background/structural white shapes are hidden
                svgEl.setAttribute('opacity', '0');
              } else {
                // Detail shapes (like black lines) strip their colors to adopt the app theme (currentColor)
                svgEl.removeAttribute('fill');
                svgEl.removeAttribute('stroke');
                svgEl.removeAttribute('class'); // Strip classes to ensure they don't override our currentColor
                if (style) {
                  const newStyle = style
                    .replace(/fill:[^;]+;?/gi, '')
                    .replace(/stroke:[^;]+;?/gi, '');
                  if (newStyle.trim()) {
                    svgEl.setAttribute('style', newStyle);
                  } else {
                    svgEl.removeAttribute('style');
                  }
                }
              }
            });
          }
          
          setSvgContent(svgElement.innerHTML);
          const originalViewBox = svgElement.getAttribute('viewBox');
          if (originalViewBox) {
            setViewBox(originalViewBox);
          }
        } else {
          setSvgContent(customIcon);
        }
      } catch (e) {
        setSvgContent(customIcon);
      }
    } else {
      setSvgContent(null);
      setViewBox('0 0 24 24'); // Standard Lucide size
    }
  }, [customIcon, customIconType, useThemeColor]);

  if (customIcon && customIconType === 'image') {
    return (
      <img 
        src={customIcon} 
        alt="Icon" 
        className={className} 
        style={{ width: size, height: size, objectFit: 'contain' }}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (svgContent) {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox={viewBox}
        fill="currentColor"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  return <Train className={className} size={size} />;
};
