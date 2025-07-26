// sanitizer.js - XSS protection utilities for frontend
// Last updated: July 25, 2025 at 8:10 PM
import DOMPurify from 'dompurify';

/**
 * Comprehensive XSS protection utilities
 */
class SecuritySanitizer {
  constructor() {
    this.purifyConfig = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'i', 'b', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li',
        'span', 'div'
      ],
      ALLOWED_ATTR: ['class', 'id'],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      SANITIZE_DOM: true
    };

    this.strictConfig = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    };
  }

  /**
   * Sanitize HTML content with comprehensive XSS protection
   * @param {string} content - The content to sanitize
   * @param {boolean} strict - Use strict mode (fewer allowed tags)
   * @returns {string} Sanitized content
   */
  sanitizeHtml(content, strict = false) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const config = strict ? this.strictConfig : this.purifyConfig;
    return DOMPurify.sanitize(content, config);
  }

  /**
   * Escape plain text to prevent XSS
   * @param {string} text - The text to escape
   * @returns {string} Escaped text
   */
  escapeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize and format novel content with proper paragraphs
   * @param {string} content - Novel chapter content
   * @returns {Array} Array of sanitized paragraph elements
   */
  sanitizeNovelContent(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    // First escape the entire content
    const escapedContent = this.escapeText(content);
    
    // Split into paragraphs and filter empty ones
    const paragraphs = escapedContent
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    return paragraphs.map((paragraph, index) => ({
      id: `paragraph-${index}`,
      content: paragraph.replace(/\n/g, '<br />'),
      sanitized: this.sanitizeHtml(paragraph.replace(/\n/g, '<br />'), true)
    }));
  }

  /**
   * Sanitize user input for forms
   * @param {string} input - User input
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} Sanitized input
   */
  sanitizeInput(input, maxLength = 10000) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Trim and limit length
    let sanitized = input.trim().substring(0, maxLength);
    
    // Remove potentially dangerous characters
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/style\s*=/gi, ''); // Remove style attributes

    return sanitized;
  }

  /**
   * Sanitize URL to prevent XSS in href attributes
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL or empty string if invalid
   */
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // List of safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
      const urlObj = new URL(url);
      
      if (safeProtocols.includes(urlObj.protocol)) {
        return url;
      }
    } catch (error) {
      // Invalid URL
    }

    return '';
  }

  /**
   * Sanitize filename for downloads
   * @param {string} filename - Filename to sanitize
   * @returns {string} Safe filename
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'download.txt';
    }

    return filename
      .replace(/[^a-zA-Z0-9.-_]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, 255); // Limit length
  }

  /**
   * Create safe React props from potentially unsafe data
   * @param {Object} data - Data object to sanitize
   * @returns {Object} Sanitized data object
   */
  sanitizeProps(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeInput(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeInput(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeProps(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Validate and sanitize API response data
   * @param {any} data - API response data
   * @returns {any} Sanitized data
   */
  sanitizeApiResponse(data) {
    if (!data) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeInput(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeApiResponse(item));
    }

    if (typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeApiResponse(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Create a Content Security Policy compliant inline style
   * @param {Object} styles - Style object
   * @returns {Object} Safe style object
   */
  sanitizeStyles(styles) {
    if (!styles || typeof styles !== 'object') {
      return {};
    }

    const safeStyles = {};
    const allowedProperties = [
      'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
      'margin', 'padding', 'border', 'borderRadius', 'width', 'height',
      'maxWidth', 'maxHeight', 'minWidth', 'minHeight', 'display',
      'flexDirection', 'justifyContent', 'alignItems', 'textAlign',
      'lineHeight', 'letterSpacing', 'textDecoration', 'textTransform'
    ];

    for (const [property, value] of Object.entries(styles)) {
      if (allowedProperties.includes(property) && typeof value === 'string') {
        // Remove potentially dangerous CSS values
        const sanitizedValue = value
          .replace(/javascript:/gi, '')
          .replace(/expression\(/gi, '')
          .replace(/url\(/gi, '')
          .replace(/import/gi, '');
        
        safeStyles[property] = sanitizedValue;
      }
    }

    return safeStyles;
  }
}

// Create singleton instance
const sanitizer = new SecuritySanitizer();

// React hook for sanitization
export const useSanitizer = () => {
  return {
    sanitizeHtml: sanitizer.sanitizeHtml.bind(sanitizer),
    escapeText: sanitizer.escapeText.bind(sanitizer),
    sanitizeNovelContent: sanitizer.sanitizeNovelContent.bind(sanitizer),
    sanitizeInput: sanitizer.sanitizeInput.bind(sanitizer),
    sanitizeUrl: sanitizer.sanitizeUrl.bind(sanitizer),
    sanitizeFilename: sanitizer.sanitizeFilename.bind(sanitizer),
    sanitizeProps: sanitizer.sanitizeProps.bind(sanitizer),
    sanitizeApiResponse: sanitizer.sanitizeApiResponse.bind(sanitizer),
    sanitizeStyles: sanitizer.sanitizeStyles.bind(sanitizer)
  };
};

// Component wrapper for safe HTML rendering
export const SafeHtml = ({ html, strict = false, className = '', ...props }) => {
  const sanitizedHtml = sanitizer.sanitizeHtml(html, strict);
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      {...props}
    />
  );
};

// Component for safe text rendering
export const SafeText = ({ text, children, ...props }) => {
  const content = text || children || '';
  const escapedText = sanitizer.escapeText(content);
  
  return (
    <span 
      dangerouslySetInnerHTML={{ __html: escapedText }}
      {...props}
    />
  );
};

export default sanitizer;
