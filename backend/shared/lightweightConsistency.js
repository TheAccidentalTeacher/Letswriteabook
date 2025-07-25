/**
 * Lightweight Consistency Checker
 * 
 * DESIGN PRINCIPLES:
 * - NO memory accumulation or growing data structures
 * - Stateless operations that don't persist data
 * - Minimal token usage in prompts
 * - Fast pattern matching, no AI calls
 * - Graceful degradation if validation fails
 */

class LightweightConsistency {
  constructor() {
    // Intentionally empty - no persistent state
    this.commonWords = new Set([
      'the', 'and', 'but', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall',
      'this', 'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how',
      'said', 'says', 'told', 'asked', 'came', 'went', 'took', 'gave', 'made',
      'with', 'from', 'they', 'them', 'their', 'there', 'then', 'than', 'some',
      'more', 'very', 'just', 'like', 'time', 'only', 'know', 'think', 'people'
    ]);
  }

  /**
   * Extract key consistency elements from existing chapters
   * Returns fresh data each time - no accumulation
   */
  extractConsistencyElements(chapters) {
    if (!chapters || chapters.length === 0) {
      return { characters: new Set(), locations: new Set(), keyObjects: new Set() };
    }

    const elements = {
      characters: new Set(),
      locations: new Set(),
      keyObjects: new Set()
    };

    // Only process recent chapters to limit scope
    const recentChapters = chapters.slice(-3);
    
    recentChapters.forEach(chapter => {
      if (!chapter?.content) return;
      
      const content = chapter.content.toLowerCase();
      
      this.findCharacterNames(content, elements.characters);
      this.findLocations(content, elements.locations);
      this.findKeyObjects(content, elements.keyObjects);
    });

    return elements;
  }

  /**
   * Find character names using simple patterns
   */
  findCharacterNames(content, characterSet) {
    // Pattern 1: Dialogue attribution - "text," said NAME
    const dialoguePattern = /"[^"]*,?"\s*(?:said|asked|replied|answered|whispered|shouted|muttered)\s+([A-Z][a-z]+)/g;
    let match;
    while ((match = dialoguePattern.exec(content)) !== null) {
      const name = match[1].toLowerCase();
      if (name.length > 2 && !this.commonWords.has(name)) {
        characterSet.add(name);
      }
    }

    // Pattern 2: NAME said/asked pattern
    const nameDialoguePattern = /([A-Z][a-z]+)\s+(?:said|asked|replied|answered|whispered|shouted|muttered)/g;
    while ((match = nameDialoguePattern.exec(content)) !== null) {
      const name = match[1].toLowerCase();
      if (name.length > 2 && !this.commonWords.has(name)) {
        characterSet.add(name);
      }
    }

    // Pattern 3: Possessive forms - NAME's
    const possessivePattern = /([A-Z][a-z]+)'s\s/g;
    while ((match = possessivePattern.exec(content)) !== null) {
      const name = match[1].toLowerCase();
      if (name.length > 2 && !this.commonWords.has(name)) {
        characterSet.add(name);
      }
    }
  }

  /**
   * Find location references
   */
  findLocations(content, locationSet) {
    // Location prepositions
    const locationPatterns = [
      /(?:at|in|to|from|near|inside|outside|within)\s+the\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /(?:entered|left|approached|reached)\s+the\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g
    ];

    locationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const location = match[1].toLowerCase();
        if (location.length > 3 && !this.isGenericLocation(location)) {
          locationSet.add(location);
        }
      }
    });
  }

  /**
   * Find key objects and items
   */
  findKeyObjects(content, objectSet) {
    // Look for "the [object]" that might be important
    const objectPattern = /\bthe\s+([a-z]+(?:\s+[a-z]+)?)\b/g;
    let match;
    
    while ((match = objectPattern.exec(content)) !== null) {
      const object = match[1];
      
      // Filter for potentially important objects
      if (object.length > 3 && 
          !this.commonWords.has(object) && 
          !this.isGenericObject(object) &&
          this.mightBeImportantObject(object)) {
        objectSet.add(object);
      }
    }
  }

  /**
   * Check if location is too generic to track
   */
  isGenericLocation(location) {
    const generic = ['room', 'place', 'area', 'spot', 'side', 'end', 'way', 'door', 'window'];
    return generic.some(g => location.includes(g));
  }

  /**
   * Check if object is too generic to track
   */
  isGenericObject(object) {
    const generic = ['thing', 'way', 'time', 'day', 'night', 'moment', 'second', 'minute', 'hour'];
    return generic.some(g => object.includes(g));
  }

  /**
   * Heuristic to identify potentially important objects
   */
  mightBeImportantObject(object) {
    // Objects that might be story-relevant
    const importantTypes = [
      'weapon', 'sword', 'gun', 'knife', 'blade',
      'book', 'letter', 'document', 'map', 'key',
      'ring', 'necklace', 'crown', 'gem', 'stone',
      'ship', 'car', 'vehicle', 'horse',
      'device', 'machine', 'computer', 'phone'
    ];
    
    return importantTypes.some(type => object.includes(type)) || 
           object.includes('crystal') || 
           object.includes('artifact') ||
           object.includes('relic');
  }

  /**
   * Generate lightweight consistency prompt
   * Returns minimal context to avoid token bloat
   */
  generateConsistencyPrompt(existingChapters) {
    if (!existingChapters || existingChapters.length === 0) {
      return "This is the first chapter - establish key characters and setting clearly.";
    }

    const elements = this.extractConsistencyElements(existingChapters);
    
    const prompts = [];
    
    if (elements.characters.size > 0) {
      const chars = Array.from(elements.characters).slice(0, 4); // Limit to prevent bloat
      prompts.push(`Established characters: ${chars.join(', ')}`);
    }
    
    if (elements.locations.size > 0) {
      const locs = Array.from(elements.locations).slice(0, 3);
      prompts.push(`Key locations: ${locs.join(', ')}`);
    }

    if (elements.keyObjects.size > 0) {
      const objs = Array.from(elements.keyObjects).slice(0, 2);
      prompts.push(`Important items: ${objs.join(', ')}`);
    }

    if (prompts.length === 0) {
      return "Maintain consistency with previous chapters.";
    }

    return `CONSISTENCY NOTES:\n- ${prompts.join('\n- ')}\n\nMaintain consistency with established elements.`;
  }

  /**
   * Quick validation check for obvious inconsistencies
   * Does not store results, just returns validation status
   */
  validateChapter(newChapterContent, existingChapters) {
    if (!existingChapters || existingChapters.length === 0) {
      return { isValid: true, warnings: [] };
    }

    const existingElements = this.extractConsistencyElements(existingChapters);
    const newElements = this.extractConsistencyElements([{ content: newChapterContent }]);
    
    const warnings = [];
    
    // Check for potential character name conflicts (typos/variations)
    newElements.characters.forEach(newChar => {
      existingElements.characters.forEach(existingChar => {
        if (this.isPotentialTypo(newChar, existingChar)) {
          warnings.push(`Possible name variation: "${newChar}" vs established "${existingChar}"`);
        }
      });
    });

    // Limit warnings to prevent spam
    return {
      isValid: warnings.length === 0,
      warnings: warnings.slice(0, 2)
    };
  }

  /**
   * Check if two names might be typos of each other
   */
  isPotentialTypo(name1, name2) {
    if (name1 === name2) return false;
    if (Math.abs(name1.length - name2.length) > 2) return false;
    
    // Simple edit distance check
    const maxLength = Math.max(name1.length, name2.length);
    let differences = 0;
    
    for (let i = 0; i < maxLength; i++) {
      if (name1[i] !== name2[i]) {
        differences++;
      }
    }
    
    // Flag if names are very similar but not identical
    return differences > 0 && differences <= 2 && name1.length > 3;
  }
}

module.exports = LightweightConsistency;
