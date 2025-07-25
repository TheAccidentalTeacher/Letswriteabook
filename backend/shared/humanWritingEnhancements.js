// humanWritingEnhancements.js - Unified Human Writing Enhancement System
// Redesigned based on quality metrics analysis: Focus on Creative Innovation (65%→85%), 
// Human-Like Writing (75%→90%), and Narrative Complexity (70%→85%)

const humanWritingEnhancements = {
  // CORE PHILOSOPHY: Less is more - focus on what works, not what to avoid
  philosophy: {
    primary: "Create authentic human storytelling through purposeful imperfection and emotional truth",
    approach: "Quality over complexity - fewer, better-executed elements"
  },

  // I. CREATIVE INNOVATION ENGINE (Target: 85%)
  // Current weakness: 65% - needs dramatic improvement
  creativeInnovation: {
    unexpectedMoments: {
      description: "Surprise readers and characters alike with genuine twists",
      techniques: [
        "Characters discover something that changes their understanding of the world",
        "Reveal information that recontextualizes earlier events",
        "Show competent characters being genuinely wrong about important things",
        "Create situations where the 'obvious' solution makes things worse"
      ]
    },
    
    subversiveChoices: {
      description: "Break reader expectations in meaningful ways",
      techniques: [
        "The quiet character becomes the most decisive in crisis",
        "The antagonist's plan succeeds but creates unexpected consequences",
        "The love interest chooses their career/mission over romance",
        "The mentor figure has crucial blind spots or outdated knowledge"
      ]
    },
    
    organicComplications: {
      description: "Problems that emerge naturally from character choices",
      techniques: [
        "Success in one area creates problems in another",
        "Character strengths become weaknesses in new situations",
        "Solutions to immediate problems create bigger long-term issues",
        "Help arrives but comes with unacceptable conditions"
      ]
    }
  },

  // II. HUMAN-LIKE AUTHENTICITY (Target: 90%)
  // Current strength: 75% - build on this foundation
  humanAuthenticity: {
    emotionalComplexity: {
      description: "Real human emotions are contradictory and layered",
      techniques: [
        "Characters feel relief and guilt simultaneously",
        "Show anger that masks fear or sadness",
        "Characters want things that conflict with their values",
        "Pride and shame about the same achievement"
      ]
    },
    
    conversationalTruth: {
      description: "How people actually talk vs. how they think they talk",
      techniques: [
        "Characters interrupt, change subjects, misunderstand",
        "Important conversations happen at bad times",
        "People avoid saying what they really mean",
        "Humor emerges from awkwardness or stress"
      ]
    },
    
    physicalReality: {
      description: "Bodies are messy and inconvenient",
      techniques: [
        "Exhaustion affects judgment and patience",
        "Hunger makes people irritable at wrong moments",
        "Physical discomfort during important conversations",
        "Illness or injury that isn't heroic or meaningful"
      ]
    }
  },

  // III. NARRATIVE COMPLEXITY (Target: 85%)
  // Current performance: 70% - needs focused improvement
  narrativeComplexity: {
    layeredConsequences: {
      description: "Every choice creates ripple effects",
      techniques: [
        "Small early decisions have major later consequences",
        "Characters' past actions return to complicate present",
        "Solutions create new problems for different characters",
        "Success requires sacrificing something important"
      ]
    },
    
    ambiguousOutcomes: {
      description: "Real resolution is messy and incomplete",
      techniques: [
        "Victory comes with genuine costs",
        "Problems get solved but relationships change",
        "Characters achieve goals but question if they were worth it",
        "New information reframes previous 'victories'"
      ]
    },
    
    interconnectedPlots: {
      description: "Multiple story threads that influence each other",
      techniques: [
        "Character B's subplot affects Character A's main story",
        "Background worldbuilding becomes plot-relevant",
        "Minor characters have their own agenda that matters",
        "Different character goals create natural conflict"
      ]
    }
  },

  // UNIFIED PROMPT SYSTEM - Consolidate all guidance into clear, actionable instructions
  prompts: {
    analysis: {
      humanLikeAdditions: `
CREATIVE INNOVATION PLANNING:
- Identify 2-3 moments where competent characters will be genuinely wrong
- Plan one major plot element that subverts genre expectations
- Design consequences where success creates new, different problems

HUMAN AUTHENTICITY SETUP:
- Give each character one physical trait that affects their behavior (chronic pain, insomnia, food allergies)
- Plan contradictory emotions for major story moments
- Identify where characters will avoid saying what they really mean

NARRATIVE COMPLEXITY FOUNDATION:
- Connect at least 3 seemingly separate plot elements
- Plan how each character's background creates current complications
- Design victory conditions that require meaningful sacrifice`
    },
    
    outline: {
      humanLikeAdditions: `
CHAPTER STRUCTURE INNOVATION:
- Vary chapter formats: some dialogue-heavy, some action, some internal reflection
- Plan 2-3 chapters where the main plot takes a backseat to character development
- Include at least one chapter that ends with a question, not an answer

AUTHENTIC PACING:
- Slow down for moments that matter emotionally, even if they don't advance plot
- Plan scenes where characters just exist together without dramatic conflict
- Include mundane frustrations that compound into bigger problems

COMPLEX PLOT WEAVING:
- Each chapter should advance 2-3 different story threads
- Minor character decisions should affect major character options
- Plan how background worldbuilding will become plot-relevant`
    },
    
    chapter: {
      humanLikeAdditions: `
CREATIVE INNOVATION IN EXECUTION:
- Include one moment that surprises both character and reader
- Show a character being wrong about something they're supposed to know
- Create a problem that gets worse when characters try the 'right' solution
- Let character strengths become disadvantages in this specific situation

HUMAN AUTHENTICITY IN SCENES:
- Characters feel multiple contradictory emotions about important events
- Include physical discomfort that affects how characters interact
- Show people failing to communicate what they actually mean
- Let exhaustion, hunger, or discomfort influence character decisions

NARRATIVE COMPLEXITY IN WRITING:
- Every scene should serve multiple story purposes
- Character actions should have consequences beyond immediate scene
- Include details that seem minor but will matter later
- Show how this chapter's events affect different characters differently

DIALOGUE AUTHENTICITY:
- People interrupt each other and talk past each other
- Important conversations happen at inconvenient times
- Characters say things they don't mean when stressed or tired
- Include subtext - what people don't say matters as much as what they do

EMOTIONAL REALISM:
- Characters can be proud and ashamed of the same thing
- Show anger that's really fear, or sadness that presents as irritation
- Characters want things that conflict with their stated values
- Relief and guilt can coexist after difficult decisions`
    }
  },

  // QUALITY TARGETS - Specific, measurable improvements
  qualityTargets: {
    creativeInnovation: {
      current: 65,
      target: 85,
      keyMetrics: [
        "Genuine surprises per chapter",
        "Expectations subverted meaningfully", 
        "Character competence challenged believably"
      ]
    },
    
    humanAuthenticity: {
      current: 75,
      target: 90,
      keyMetrics: [
        "Contradictory emotions shown",
        "Physical reality impacts on behavior",
        "Conversational authenticity"
      ]
    },
    
    narrativeComplexity: {
      current: 70,
      target: 85,
      keyMetrics: [
        "Interconnected plot threads",
        "Consequences spanning multiple chapters",
        "Ambiguous outcomes that feel real"
      ]
    }
  }
};

module.exports = humanWritingEnhancements;
