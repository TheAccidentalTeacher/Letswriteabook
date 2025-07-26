const mongoose = require('mongoose');

const outlineChapterSchema = new mongoose.Schema({
  chapterNumber: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  keyEvents: {
    type: [String],
    required: true
  },
  characterFocus: {
    type: [String],
    required: true
  },
  plotAdvancement: {
    type: String,
    required: true
  },
  wordTarget: {
    type: Number,
    required: true
  },
  genreElements: {
    type: [String],
    required: true
  },
  humanLikeElements: {
    structureType: String,
    characterConflict: String,
    moralComplexity: String,
    unresolvedElement: String,
    surpriseElement: String,
    mundaneDetail: String
  }
});

const chapterSchema = new mongoose.Schema({
  chapterNumber: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: function() { return this.status === 'completed'; } // Only required for completed chapters
  },
  wordCount: {
    type: Number,
    required: function() { return this.status === 'completed'; }
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttemptAt: Date,
  failureReason: String,
  qualityScore: {
    type: Number,
    default: 0
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  tokensUsed: Number,
  cost: Number
});

const jobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['planning', 'outlining', 'writing', 'completed', 'failed', 'recovering'],
    default: 'planning',
    required: true,
    index: true
  },
  currentPhase: {
    type: String,
    enum: ['premise_analysis', 'outline_generation', 'chapter_writing', 'quality_validation', 'finalization', 'completed'],
    default: 'premise_analysis',
    required: true
  },
  
  // Story data
  premise: { 
    type: String, 
    maxLength: 30000, // ~5,000 words
    required: true
  },
  synopsis: {
    type: String,
    maxLength: 50000 // Allow for longer synopsis
  },
  title: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    required: true
  },
  subgenre: {
    type: String,
    required: true
  },
  targetWordCount: {
    type: Number,
    required: true,
    min: 20000,
    max: 200000
  },
  targetChapters: {
    type: Number,
    required: true,
    min: 5,
    max: 50
  },
  humanLikeWriting: {
    type: Boolean,
    default: true,
    required: true
  },
  
  // Generated content
  outline: [outlineChapterSchema],
  chapters: [chapterSchema],
  
  // Model usage tracking
  modelUsage: {
    outlineGeneration: {
      model: String,
      tokensUsed: Number,
      cost: Number,
      duration: Number
    },
    chapterGeneration: {
      model: String,
      tokensUsed: Number,
      cost: Number,
      duration: Number
    }
  },
  
  // Progress tracking
  progress: {
    outlineComplete: {
      type: Boolean,
      default: false
    },
    chaptersCompleted: {
      type: Number,
      default: 0
    },
    chaptersFailed: {
      type: Number,
      default: 0
    },
    totalChapters: {
      type: Number,
      required: true
    },
    failedChapterNumbers: [{
      type: Number
    }],
    hasFailures: {
      type: Boolean,
      default: false
    },
    estimatedCompletion: Date,
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  
  // Quality metrics
  qualityMetrics: {
    averageChapterLength: Number,
    genreAdherence: Number,
    characterConsistency: Number,
    plotContinuity: Number
  },
  
  // Enhanced monitoring metadata
  metadata: {
    // Story Bible for continuity tracking
    storyBible: {
      characters: {
        type: Map,
        of: {
          description: String,
          traits: [String],
          relationships: [String],
          lastSeen: Number,
          firstAppearance: Number
        },
        default: new Map()
      },
      plotThreads: [{
        title: String,
        description: String,
        status: {
          type: String,
          enum: ['active', 'resolved', 'developing'],
          default: 'active'
        },
        introducedIn: Number,
        lastUpdated: Number
      }],
      timeline: [{
        title: String,
        description: String,
        chapter: Number,
        timestamp: Date,
        importance: {
          type: String,
          enum: ['minor', 'major', 'critical'],
          default: 'minor'
        }
      }],
      locations: {
        type: Map,
        of: {
          description: String,
          firstMentioned: Number,
          significance: String
        },
        default: new Map()
      },
      themes: [{
        name: String,
        description: String,
        examples: [String]
      }]
    },
    
    // Continuity alerts
    continuityAlerts: [{
      id: String,
      severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
      },
      message: String,
      details: String,
      suggestion: String,
      context: {
        chapter: Number,
        character: String,
        plotThread: String
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    
    // Enhanced quality metrics
    enhancedQualityMetrics: {
      humanLikenessScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      complexityScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      consistencyScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      creativityScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      }
    },
    
    // Cost tracking details
    costTracking: {
      totalCost: {
        type: Number,
        default: 0
      },
      tokensUsed: {
        type: Number,
        default: 0
      },
      estimatedRemaining: {
        type: Number,
        default: 0
      },
      breakdown: {
        analysis: {
          type: Number,
          default: 0
        },
        outline: {
          type: Number,
          default: 0
        },
        chapters: {
          type: Number,
          default: 0
        }
      }
    },
    
    // Applied enhancements log
    enhancementsApplied: [{
      id: String,
      type: {
        type: String,
        enum: ['character', 'dialogue', 'plot', 'style', 'world'],
        default: 'style'
      },
      name: String,
      description: String,
      details: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    
    // AI decision log
    aiDecisions: [{
      id: String,
      type: {
        type: String,
        enum: ['character-development', 'plot-choice', 'dialogue-style', 'scene-setting', 'enhancement-application', 'continuity-check'],
        default: 'enhancement-application'
      },
      summary: String,
      reasoning: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      alternatives: [{
        option: String,
        reason: String
      }],
      impact: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    
    // System performance tracking
    performance: {
      averageResponseTime: Number,
      totalRequests: {
        type: Number,
        default: 0
      },
      errorCount: {
        type: Number,
        default: 0
      },
      lastHealthCheck: Date
    },
    
    // Generation progress details
    currentStep: String,
    estimatedTimeRemaining: Number,
    phaseStartTimes: {
      premise_analysis: Date,
      outline_generation: Date,
      chapter_writing: Date,
      quality_validation: Date,
      finalization: Date
    }
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  completedAt: Date
});

// Add indexes for performance
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ status: 1, updatedAt: -1 });

// Add pre-save hook to update timestamps
jobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Job', jobSchema);
