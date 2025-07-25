const { OpenAI } = require('openai');
const Job = require('../models/job');
const logger = require('../logger');
const { 
  emitJobUpdate, 
  emitPhaseTransition, 
  emitGenerationProgress, 
  emitCostTracking,
  emitQualityMetrics 
} = require('../websocket');
const genreInstructions = require('../shared/genreInstructions');
const humanWritingEnhancements = require('../shared/humanWritingEnhancements');
const universalFramework = require('../shared/universalHumanWritingFramework');
const advancedRefinements = require('../shared/advancedHumanWritingRefinements');
const ContinuityGuardian = require('../shared/continuityGuardian');

class AIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.activeJobs = new Map();
    
    // Cost tracking per model (prices as of 2024)
    // Model limits: gpt-4o/gpt-4o-mini context: 128K tokens, output: 16K tokens
    // For novel generation, we prioritize quality over artificial token limits
    this.costTracking = {
      'gpt-4o': {
        inputCost: 0.005,  // $0.005 per 1K tokens
        outputCost: 0.015  // $0.015 per 1K tokens
      },
      'gpt-4o-mini': {
        inputCost: 0.00015, // $0.00015 per 1K tokens
        outputCost: 0.0006  // $0.0006 per 1K tokens
      }
    };
  }
  
  async generateNovel(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Initialize continuity guardian for story consistency tracking
    const continuityGuardian = new ContinuityGuardian(jobId);
    
    // Add to active jobs
    this.activeJobs.set(jobId, {
      startTime: Date.now(),
      status: 'planning',
      continuityGuardian: continuityGuardian
    });
    
    try {
      // Emit phase transition
      emitPhaseTransition(jobId, {
        from: 'initialization',
        to: 'analysis',
        phase: 'Analyzing premise and planning story structure'
      });
      
      // Phase 1: Premise Analysis
      await this.analyzePremise(jobId);
      
      // Phase 2: Generate Outline
      await this.generateOutline(jobId);
      
      // Phase 3: Generate All Chapters
      await this.generateAllChapters(jobId);
      
      // Mark job as completed
      job.status = 'completed';
      job.currentPhase = 'completed';
      job.progress.lastActivity = new Date();
      await job.save();
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
      emitJobUpdate(jobId, {
        status: 'completed',
        currentPhase: 'completed',
        message: 'Novel generation completed successfully!'
      });
      
      logger.info(`Completed novel generation for job ${jobId}`);
      
    } catch (error) {
      await this.handleGenerationError(jobId, error);
    }
  }
  
  async analyzePremise(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    job.status = 'planning';
    job.currentPhase = 'premise_analysis';
    job.progress.lastActivity = new Date();
    await job.save();
    
    emitJobUpdate(jobId, {
      status: job.status,
      currentPhase: job.currentPhase,
      message: 'Analyzing premise and planning structure...'
    });
    
    try {
      const analysisStart = Date.now();
      
      // Get genre-specific instructions
      const genreInstruction = genreInstructions[job.genre]?.[job.subgenre];
      if (!genreInstruction) {
        throw new Error(`Unsupported genre combination: ${job.genre}/${job.subgenre}`);
      }
      
      const analysisPrompt = `
Analyze this novel premise and provide structural recommendations:

PREMISE: "${job.premise}"

GENRE: ${job.genre.replace(/_/g, ' ')}
SUBGENRE: ${job.subgenre.replace(/_/g, ' ')}
TARGET WORD COUNT: ${job.targetWordCount}
TARGET CHAPTERS: ${job.targetChapters}

GENRE GUIDELINES:
${genreInstruction}

${job.humanLikeWriting ? humanWritingEnhancements.prompts.analysis.humanLikeAdditions : ''}

${job.humanLikeWriting ? universalFramework.promptEnhancements.analysis : ''}

${job.humanLikeWriting ? advancedRefinements.level5Prompts.analysis : ''}

Please provide a comprehensive analysis that prioritizes ${job.humanLikeWriting ? 'authentic, human-like storytelling' : 'engaging storytelling'}:

ANALYSIS REQUIREMENTS:
1. Theme analysis - themes that allow for moral complexity
2. Character archetypes - with internal contradictions and growth potential
3. Plot structure - that accommodates meaningful failures and setbacks
4. Key story beats - including moments of genuine uncertainty
5. Potential subplots - that may remain partially unresolved
6. Tone and style guidance - that varies subtly throughout
${job.humanLikeWriting ? `7. HUMAN-LIKE ELEMENTS:
   - Internal character conflicts that create lasting tension
   - Opportunities for protagonist to be genuinely wrong
   - Morally ambiguous situations requiring difficult choices
   - Cultural/world elements that add lived-in authenticity
   - Distinctive character voice planning (speech patterns, vocabulary)` : `7. ENGAGING ELEMENTS:
   - Clear character motivations and goals
   - Compelling conflicts and obstacles
   - Satisfying story progression
   - Genre-appropriate atmosphere and tone`}

Respond in JSON format:
{
  "themes": ["theme1", "theme2"],
  "characters": [{"type": "character_type", "conflicts": "internal_struggles", "speechPattern": "distinctive_traits"}],
  "plotStructure": "structure_with_flexibility_for_messiness",
  "keyBeats": ["beat1", "beat2"],
  "subplots": [{"main": "subplot", "resolution": "complete|partial|unresolved"}],
  "tone": "description_that_allows_variation",
  "styleNotes": "guidance_for_character_specific_prose"${job.humanLikeWriting ? `,
  "humanLikeElements": {
    "characterConflicts": ["lasting_disagreement1", "lasting_disagreement2"],
    "moralDilemmas": ["situation1", "situation2"],
    "culturalElements": ["in_world_reference1", "in_world_reference2"],
    "unresolvedElements": ["mystery1", "relationship_tension1"]
  }` : ''}
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 4000 // Increased for detailed analysis
      });
      
      const analysisResult = this.extractJSON(response.choices[0].message.content);
      
      // Log AI decision for premise analysis
      // monitoringService.logAIDecision(jobId, {
      //   type: 'premise-analysis',
      //   context: `Genre: ${job.genre}/${job.subgenre}`,
      //   reasoning: 'Analyzed premise to identify key themes, character archetypes, and plot structure',
      //   choice: `Selected ${analysisResult.themes?.length || 0} main themes and ${analysisResult.characters?.length || 0} character archetypes`,
      //   confidence: 0.8
      // });
      
      // Update story bible with initial themes and character concepts
      // monitoringService.updateStoryBible(jobId, {
      //   themes: analysisResult.themes?.map(theme => ({ name: theme, description: `Theme identified during premise analysis` })) || [],
      //   characters: Object.fromEntries(
      //     (analysisResult.characters || []).map(char => [
      //       char.type || 'Unnamed Character',
      //       {
      //         description: char.conflicts || 'Character concept from analysis',
      //         traits: [char.speechPattern || 'Distinctive voice'],
      //         relationships: [],
      //         lastSeen: null
      //       }
      //     ])
      //   )
      // });
      
      // Calculate cost
      const cost = this.calculateCost(
        'gpt-4o-mini',
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      );
      
      // Update job with analysis
      job.analysis = analysisResult;
      job.modelUsage.premiseAnalysis = {
        model: 'gpt-4o-mini',
        tokensUsed: response.usage.total_tokens,
        cost: cost,
        duration: Date.now() - analysisStart
      };
      
      await job.save();
      
      // Update quality metrics based on analysis depth
      const analysisQuality = {
        complexityScore: Math.min(0.8, (analysisResult.themes?.length || 0) * 0.1 + (analysisResult.characters?.length || 0) * 0.1),
        humanLikenessScore: job.humanLikeWriting ? 0.7 : 0.5,
        consistencyScore: 0.8, // High at start, will be updated during writing
        creativityScore: analysisResult.humanLikeElements ? 0.7 : 0.6
      };
      
      // monitoringService.updateQualityMetrics(jobId, analysisQuality); // Removed - was causing crashes
      
      logger.info(`Completed premise analysis for job ${jobId}`);
      
    } catch (error) {
      throw new Error(`Premise analysis failed: ${error.message}`);
    }
  }
  
  async generateOutline(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Emit phase transition
    emitPhaseTransition(jobId, {
      from: 'analysis',
      to: 'outlining',
      phase: 'Creating detailed chapter-by-chapter outline'
    });
    
    // Check for potential token limit issues with large outlines
    if (job.targetChapters > 40) {
      logger.warn(`Large outline requested: ${job.targetChapters} chapters. May hit token limits.`);
      emitJobUpdate(jobId, {
        message: `Generating large outline (${job.targetChapters} chapters). This may take longer and be less detailed per chapter.`
      });
    }
    
    job.status = 'outlining';
    job.currentPhase = 'outline_generation';
    job.progress.lastActivity = new Date();
    await job.save();
    
    emitJobUpdate(jobId, {
      status: job.status,
      currentPhase: job.currentPhase,
      message: 'Creating detailed chapter outline...'
    });
    
    try {
      const outlineStart = Date.now();
      
      const outlinePrompt = `
Create a ${job.targetChapters}-chapter outline for "${job.title}" (${job.genre.replace(/_/g, ' ')} - ${job.subgenre.replace(/_/g, ' ')}).

PREMISE: ${job.premise}
WORD COUNT: ${job.targetWordCount} total (~${Math.round(job.targetWordCount / job.targetChapters)} per chapter)

ANALYSIS: ${JSON.stringify(job.analysis || {}, null, 1)}

${job.humanLikeWriting ? humanWritingEnhancements.prompts.outline.humanLikeAdditions : ''}

${job.humanLikeWriting ? universalFramework.promptEnhancements.outline : ''}

${job.humanLikeWriting ? advancedRefinements.level5Prompts.outline : ''}

${job.humanLikeWriting ? `HUMAN-LIKE OUTLINE REQUIREMENTS:
- Create significant variation in chapter lengths (some 800 words, others 3000+ words)
- Mix chapter types: action, dialogue-heavy, introspective, world-building focused
- Plan at least 2 meaningful character failures that don't immediately resolve
- Include 1-2 chapters with unresolved endings that complicate rather than clarify
- Design at least one major plot twist that genuinely surprises (not just reveals)
- Ensure internal character conflicts span multiple chapters without easy resolution
- Plan chapters that show the same events from different character perspectives
- Include at least one chapter told through non-traditional format (logs, messages, flashbacks)` : `OUTLINE REQUIREMENTS:
- Create engaging chapter progression with clear story beats
- Build tension and character development throughout
- Include compelling conflicts and resolutions
- Maintain genre conventions and reader expectations`}

Create exactly ${job.targetChapters} chapters with detailed descriptions that embrace ${job.humanLikeWriting ? 'narrative complexity' : 'engaging storytelling'}:

JSON format:
{
  "outline": [
    {
      "chapterNumber": 1,
      "title": "Chapter Title",
      "summary": "Key events and plot progression",
      "keyEvents": ["event1", "event2", "event3"],
      "characterFocus": ["char1", "char2"],
      "plotAdvancement": "How this chapter advances or complicates the main plot",
      "wordTarget": ${Math.round(job.targetWordCount / job.targetChapters)},
      "genreElements": ["genre-specific element1", "genre-specific element2"]${job.humanLikeWriting ? `,
      "humanLikeElements": {
        "structureType": "traditional|dialogue-heavy|introspective|action|logs|flashback",
        "characterConflict": "internal_or_interpersonal_tension_introduced_or_developed",
        "moralComplexity": "ethical_dilemma_or_ambiguous_situation",
        "unresolvedElement": "something_left_hanging_or_complicated",
        "surpriseElement": "unexpected_development_or_character_choice",
        "mundaneDetail": "lived_in_world_element_that_adds_authenticity"
      }` : ''}
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: outlinePrompt }],
        temperature: 0.4,
        max_tokens: Math.min(16000, Math.max(8000, job.targetChapters * 300)) // Respect OpenAI's 16K token limit
      });
      
      const outlineResult = this.extractJSON(response.choices[0].message.content);
      
      // Calculate cost
      const cost = this.calculateCost(
        'gpt-4o-mini',
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      );
      
      // Update job with outline
      job.outline = outlineResult.outline;
      job.progress.outlineComplete = true;
      job.modelUsage.outlineGeneration = {
        model: 'gpt-4o-mini',
        tokensUsed: response.usage.total_tokens,
        cost: cost,
        duration: Date.now() - outlineStart
      };
      
      await job.save();
      
      emitJobUpdate(jobId, {
        status: job.status,
        currentPhase: job.currentPhase,
        progress: {
          ...job.progress,
          outlineComplete: true
        },
        message: 'Outline completed. Starting chapter generation...'
      });
      
      logger.info(`Completed outline generation for job ${jobId}`);
      
    } catch (error) {
      throw new Error(`Outline generation failed: ${error.message}`);
    }
  }
  
  async generateAllChapters(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    if (!job.outline || job.outline.length === 0) {
      throw new Error(`No outline found for job ${jobId}`);
    }
    
    job.status = 'writing';
    job.currentPhase = 'chapter_writing';
    job.progress.lastActivity = new Date();
    await job.save();
    
    emitJobUpdate(jobId, {
      status: job.status,
      currentPhase: job.currentPhase,
      message: 'Starting chapter generation...'
    });
    
    const chapterGenerationStart = Date.now();
    let totalTokensUsed = 0;
    let totalCost = 0;
    let totalAttempts = 0;
    
    // Generate chapters sequentially to avoid race conditions
    
    // Initialize chapter slots from outline - this prevents chapter loss
    await this.initializeChapterSlots(jobId);
    
    for (let i = 0; i < job.outline.length; i++) {
      const chapterOutline = job.outline[i];
      const chapterNumber = chapterOutline.chapterNumber || (i + 1);
      
      // Check if job has been cancelled before each chapter
      const currentJob = await Job.findById(jobId);
      if (!currentJob || currentJob.status === 'failed' || currentJob.currentPhase === 'cancelled') {
        logger.info(`Job ${jobId} was cancelled, stopping generation at chapter ${chapterNumber}`);
        
        // Clean up activeJobs
        this.activeJobs.delete(jobId);
        
        // Emit cancellation update
        emitJobUpdate(jobId, {
          status: 'cancelled',
          currentPhase: 'cancelled',
          message: 'Generation cancelled by user'
        });
        
        throw new Error('Job cancelled by user');
      }
      
      emitJobUpdate(jobId, {
        currentPhase: 'chapter_writing',
        message: `Generating chapter ${chapterNumber} of ${job.targetChapters}...`,
        progress: {
          chaptersCompleted: job.progress.chaptersCompleted,
          chaptersFailed: job.progress.chaptersFailed || 0,
          totalChapters: job.targetChapters
        }
      });
      
      // Generate the chapter with proper retry logic
      const chapterResult = await this.generateChapterWithRetry(jobId, chapterNumber, chapterOutline);
      
      if (chapterResult.success) {
        // Update successful chapter in database
        await this.updateChapterInDatabase(jobId, chapterResult.chapter);
        
        // Update counters
        totalTokensUsed += chapterResult.chapter.tokensUsed || 0;
        totalCost += chapterResult.chapter.cost || 0;
        totalAttempts += chapterResult.chapter.attempts || 1;
        
        // Update progress
        job.progress.chaptersCompleted++;
        
        emitJobUpdate(jobId, {
          currentPhase: 'chapter_writing',
          progress: {
            chaptersCompleted: job.progress.chaptersCompleted,
            chaptersFailed: job.progress.chaptersFailed || 0,
            totalChapters: job.targetChapters
          },
          message: `Chapter ${chapterNumber} completed. ${job.progress.chaptersCompleted}/${job.targetChapters} chapters done.`
        });
        
      } else {
        // Mark chapter as failed
        await this.markChapterAsFailed(jobId, chapterNumber, chapterResult.error);
        job.progress.chaptersFailed = (job.progress.chaptersFailed || 0) + 1;
        job.progress.hasFailures = true;
        if (!job.progress.failedChapterNumbers) job.progress.failedChapterNumbers = [];
        if (!job.progress.failedChapterNumbers.includes(chapterNumber)) {
          job.progress.failedChapterNumbers.push(chapterNumber);
        }
        
        const statusMessage = `Chapter ${chapterNumber} failed after ${chapterResult.attempts} attempts. ${job.progress.chaptersFailed} chapters failed.`;
        
        emitJobUpdate(jobId, {
          currentPhase: 'chapter_writing',
          progress: {
            chaptersCompleted: job.progress.chaptersCompleted,
            chaptersFailed: job.progress.chaptersFailed,
            totalChapters: job.targetChapters,
            hasFailures: job.progress.hasFailures,
            failedChapterNumbers: job.progress.failedChapterNumbers
          },
          message: statusMessage
        });
        
        logger.warn(`Chapter ${chapterNumber} failed for job ${jobId}: ${chapterResult.error}`);
      }
      
      // Calculate estimated completion time
      const timePerChapter = (Date.now() - chapterGenerationStart) / (i + 1);
      const chaptersRemaining = job.targetChapters - (i + 1);
      const estimatedTimeRemaining = timePerChapter * chaptersRemaining;
      job.progress.estimatedCompletion = new Date(Date.now() + estimatedTimeRemaining);
      job.progress.lastActivity = new Date();
      
      // Save progress after each chapter
      await job.save();
      
      // Small delay to prevent MongoDB race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update job with final chapter generation stats
    job.modelUsage.chapterGeneration = {
      model: 'gpt-4o',
      tokensUsed: totalTokensUsed,
      cost: totalCost,
      attempts: totalAttempts,
      duration: Date.now() - chapterGenerationStart
    };
    
    // Calculate quality metrics
    if (job.chapters.length > 0) {
      const completedChapters = job.chapters.filter(ch => ch.status === 'completed');
      const successfulChapters = job.progress.chaptersCompleted || 0;
      const failedChapters = job.progress.chaptersFailed || 0;
      
      if (completedChapters.length > 0) {
        const averageChapterLength = completedChapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0) / completedChapters.length;
        const totalWordCount = completedChapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0);
        
        job.qualityMetrics = {
          averageChapterLength: Math.round(averageChapterLength),
          totalWordCount: totalWordCount,
          targetAccuracy: Math.round((totalWordCount / job.targetWordCount) * 100),
          chaptersCompleted: successfulChapters,
          chaptersFailed: failedChapters,
          completionRate: Math.round((successfulChapters / job.targetChapters) * 100),
          hasFailures: job.progress.hasFailures || false,
          failedChapters: job.progress.failedChapterNumbers || []
        };
      }
      
      // Determine final status
      if (successfulChapters === 0) {
        // Complete failure
        job.status = 'failed';
        job.error = `All chapter generation failed. ${failedChapters} chapters could not be generated.`;
      } else if (successfulChapters === job.targetChapters) {
        // Complete success
        job.status = 'completed';
        job.currentPhase = 'completed';
      } else {
        // Partial success - mark as completed with warnings
        job.status = 'completed';
        job.currentPhase = 'completed';
        job.error = `Novel completed with ${failedChapters} failed chapters. Chapters ${(job.progress.failedChapterNumbers || []).join(', ')} need to be regenerated.`;
      }
      
      // Emit final status with detailed information
      const finalMessage = successfulChapters === job.targetChapters 
        ? 'Novel generation completed successfully!'
        : `Novel completed with ${successfulChapters}/${job.targetChapters} chapters. ${failedChapters} chapters failed and can be retried.`;
      
      emitJobUpdate(jobId, {
        status: job.status,
        currentPhase: job.currentPhase,
        progress: job.progress,
        message: finalMessage,
        qualityMetrics: job.qualityMetrics
      });
      
      logger.info(`Completed chapter generation for job ${jobId}: ${successfulChapters} successful, ${failedChapters} failed`);
    } else {
      job.qualityMetrics = {
        chaptersCompleted: job.chapters.length,
        completionRate: Math.round((job.chapters.length / job.targetChapters) * 100)
      };
    }
    
    job.progress.lastActivity = new Date();
    await job.save();
    
    // Check cost alert
    if (totalCost > parseFloat(process.env.COST_ALERT_THRESHOLD || '25.00')) {
      logger.warn(`Cost alert: Job ${jobId} exceeded threshold with $${totalCost.toFixed(4)}`);
    }
    
    logger.info(`Completed generating all chapters for job ${jobId}`);
  }

  // Initialize chapter slots to prevent loss - creates placeholder entries for all chapters
  async initializeChapterSlots(jobId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Clear existing chapters and create placeholders for all chapters
    job.chapters = [];
    
    for (let i = 0; i < job.outline.length; i++) {
      const chapterOutline = job.outline[i];
      const chapterNumber = chapterOutline.chapterNumber || (i + 1);
      
      // Create placeholder chapter
      const placeholderChapter = {
        chapterNumber: chapterNumber,
        title: chapterOutline.title,
        status: 'pending',
        attempts: 0,
        content: null,
        wordCount: null
      };
      
      job.chapters.push(placeholderChapter);
    }
    
    await job.save();
    logger.info(`Initialized ${job.chapters.length} chapter slots for job ${jobId}`);
  }

  // Enhanced chapter generation with proper error handling
  async generateChapterWithRetry(jobId, chapterNumber, chapterOutline) {
    const maxAttempts = 3;
    let attempts = 0;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Update chapter status to 'generating'
        await this.updateChapterStatus(jobId, chapterNumber, 'generating', attempts);
        
        const chapter = await this.generateSingleChapter(jobId, chapterNumber, chapterOutline, attempts);
        
        // Mark as completed
        chapter.status = 'completed';
        chapter.attempts = attempts;
        
        return {
          success: true,
          chapter: chapter,
          attempts: attempts
        };
        
      } catch (error) {
        lastError = error;
        logger.error(`Attempt ${attempts} failed for chapter ${chapterNumber} in job ${jobId}:`, error);
        
        // Update chapter with failure info
        await this.updateChapterStatus(jobId, chapterNumber, 'generating', attempts, error.message);
        
        if (attempts >= maxAttempts) {
          break;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    
    // All attempts failed
    await this.updateChapterStatus(jobId, chapterNumber, 'failed', attempts, lastError.message);
    
    return {
      success: false,
      error: lastError.message,
      attempts: attempts
    };
  }

  // Update chapter status in database
  async updateChapterStatus(jobId, chapterNumber, status, attempts, failureReason = null) {
    const job = await Job.findById(jobId);
    if (!job) return;
    
    const chapterIndex = job.chapters.findIndex(ch => ch.chapterNumber === chapterNumber);
    if (chapterIndex >= 0) {
      job.chapters[chapterIndex].status = status;
      job.chapters[chapterIndex].attempts = attempts;
      job.chapters[chapterIndex].lastAttemptAt = new Date();
      if (failureReason) {
        job.chapters[chapterIndex].failureReason = failureReason;
      }
      await job.save();
    }
  }

  // Update completed chapter in database
  async updateChapterInDatabase(jobId, chapter) {
    const job = await Job.findById(jobId);
    if (!job) return;
    
    const chapterIndex = job.chapters.findIndex(ch => ch.chapterNumber === chapter.chapterNumber);
    if (chapterIndex >= 0) {
      job.chapters[chapterIndex] = chapter;
      await job.save();
    }
  }

  // Mark chapter as failed with proper tracking
  async markChapterAsFailed(jobId, chapterNumber, errorMessage) {
    const job = await Job.findById(jobId);
    if (!job) return;
    
    const chapterIndex = job.chapters.findIndex(ch => ch.chapterNumber === chapterNumber);
    if (chapterIndex >= 0) {
      job.chapters[chapterIndex].status = 'failed';
      job.chapters[chapterIndex].failureReason = errorMessage;
      job.chapters[chapterIndex].lastAttemptAt = new Date();
    }
    
    await job.save();
  }

  // Renamed from generateChapter to be more specific
  async generateSingleChapter(jobId, chapterNumber, chapterOutline, attempts = 1) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Validate chapter outline structure
    if (!chapterOutline) {
      throw new Error(`Chapter outline for chapter ${chapterNumber} is missing`);
    }
    
    if (!chapterOutline.title || !chapterOutline.summary) {
      throw new Error(`Chapter outline for chapter ${chapterNumber} is incomplete (missing title or summary)`);
    }
    
    if (!chapterOutline.keyEvents || !Array.isArray(chapterOutline.keyEvents)) {
      logger.warn(`Chapter ${chapterNumber} has invalid keyEvents, using fallback`);
      chapterOutline.keyEvents = ['Chapter events to be determined'];
    }
    
    if (!chapterOutline.wordTarget || isNaN(chapterOutline.wordTarget)) {
      logger.warn(`Chapter ${chapterNumber} has invalid wordTarget, using fallback`);
      chapterOutline.wordTarget = Math.round(job.targetWordCount / job.targetChapters);
    }
    
    // Check for very large chapters that might hit token limits
    if (chapterOutline.wordTarget > 8000) {
      logger.warn(`Very large chapter ${chapterNumber} requested: ${chapterOutline.wordTarget} words. May hit token limits.`);
      // Cap at 8000 words to avoid token limit issues
      chapterOutline.wordTarget = Math.min(chapterOutline.wordTarget, 8000);
    }
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      retryCount++;
      
      try {
        const chapterStart = Date.now();
        
        // Get genre-specific instructions
        const genreInstruction = genreInstructions[job.genre]?.[job.subgenre];
        
        const chapterPrompt = `
Write Chapter ${chapterNumber} of the novel "${job.title}".

CHAPTER OUTLINE:
Title: ${chapterOutline.title}
Summary: ${chapterOutline.summary}
Key Events: ${chapterOutline.keyEvents.join(', ')}
Target Word Count: ${chapterOutline.wordTarget}${job.humanLikeWriting ? `
Human-Like Elements: ${JSON.stringify(chapterOutline.humanLikeElements || {}, null, 1)}` : ''}

NOVEL CONTEXT:
Premise: "${job.premise}"
Genre: ${job.genre.replace(/_/g, ' ')} - ${job.subgenre.replace(/_/g, ' ')}
Previous chapters: ${job.chapters.length > 0 ? job.chapters.slice(-3).map(ch => `Ch${ch.chapterNumber}: ${ch.title} (${ch.wordCount}w)`).join('; ') : 'This is the first chapter'}
Story progress: Chapter ${chapterNumber} of ${job.targetChapters} total

GENRE GUIDELINES:
${genreInstruction}

ANALYSIS CONTEXT:
${job.targetChapters > 20 ? 
  `Key themes: ${job.analysis?.themes?.join(', ') || 'N/A'}
Main characters: ${job.analysis?.characters?.join(', ') || 'N/A'}${job.humanLikeWriting ? `
Human-like story elements: ${JSON.stringify(job.analysis?.humanLikeElements || {}, null, 1)}` : ''}` :
  JSON.stringify(job.analysis || {}, null, 1)}

${job.humanLikeWriting ? humanWritingEnhancements.prompts.chapter.humanLikeAdditions : ''}

${job.humanLikeWriting ? universalFramework.promptEnhancements.chapter : ''}

${job.humanLikeWriting ? advancedRefinements.level5Prompts.chapter : ''}

${job.humanLikeWriting ? `LEVEL 5 ADVANCED HUMAN AUTHENTICITY IMPLEMENTATION:

FACTION BREAKING POINT - INTERNAL CONFLICTS WITH CONSEQUENCES:
- Show ally factions sabotaging protagonist's plans from genuine good intentions (no clear villains)
- Force leader into choice between authoritarian control and collaborative risk with lasting consequences
- Make internal division as dangerous as external threats - competing survival needs drive conflict
- Create "hard choice" scenarios where every option creates lasting community division

POWER COST ENFORCEMENT - MEANINGFUL LIMITATIONS:
- After significant ability use, show character suffering real biological/psychological costs (memory loss, exhaustion, vulnerability)
- Include empathetic feedback where protector characters physically/emotionally feel pain when their charges suffer
- Create recovery periods where powerful characters are dependent on others and cannot use abilities
- Never let powers solve problems without exacting meaningful prices that affect story progression

STRUCTURAL SUBVERSION - BREAK ESTABLISHED PATTERNS:
- Avoid repetitive meeting/discussion locations (break cantina meeting pattern if established)
- Include critical decision made by isolated character with no time for group consultation
- Show how small character weakness or overlooked detail catastrophically derails simple plans
- Create genuine surprise that feels inevitable once revealed - subvert reader expectations intelligently

ACTIVE PROSE CONSTRAINTS - FORBIDDEN PHRASE ENFORCEMENT:
- ABSOLUTELY FORBIDDEN: "silver-flecked eyes," "copper-plated exosuit," "vibrant hair," "living suit," "multi-tool gauntlet," "weathered face," "steely determination," "nanite cloak," "luminescent ink"
- Describe characters/equipment through action and environmental effect: "weight settled across shoulders" not "heavy exosuit"
- Use fresh, specific details that haven't appeared in previous chapters
- Show character traits through behavior and dialogue, not repetitive physical descriptions

ADVANCED AUTHENTICITY TECHNIQUES:
- Let established character strengths become weaknesses under different pressures
- Show internal faction politics affecting every decision, not just major plot points
- Include moments where characters surprise themselves with choices under pressure
- Create dialogue subtext that contradicts spoken words, revealing deeper faction conflicts
- Make consequences of past chapters continue to affect current events and relationships

Write approximately ${chapterOutline.wordTarget} words that push established complexity to breaking points and challenge reader expectations while maintaining narrative authenticity.` : `Write approximately ${chapterOutline.wordTarget} words of engaging prose that maintains genre conventions and advances the story effectively.`}

Write only the chapter content, no metadata or formatting.`;

        // Emit generation progress
        emitGenerationProgress(jobId, {
          phase: 'chapter_generation',
          chapterNumber,
          status: 'ai_generating',
          wordTarget: chapterOutline.wordTarget,
          details: `Generating chapter ${chapterNumber}: "${chapterOutline.title}"`
        });

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: chapterPrompt }],
          temperature: 0.7,
          max_tokens: Math.min(16000, Math.max(4000, Math.round(chapterOutline.wordTarget * 1.6))) // Respect 16K limit, reduce multiplier
        });
        
        const chapterContent = response.choices[0].message.content.trim();
        const wordCount = this.countWords(chapterContent);
        
        // Emit generation completion
        emitGenerationProgress(jobId, {
          phase: 'chapter_generation',
          chapterNumber,
          status: 'ai_completed',
          wordsGenerated: wordCount,
          wordTarget: chapterOutline.wordTarget,
          details: `Chapter ${chapterNumber} generated: ${wordCount} words`
        });
        
        // Validate continuity if enabled
        let continuityValidation = { isValid: true, issues: [], suggestions: [] };
        const activeJob = this.activeJobs.get(jobId);
        const continuityGuardian = activeJob?.continuityGuardian;
        
        if (job.humanLikeWriting && job.continuityGuardian !== false && continuityGuardian) {
          try {
            // Emit validation start
            emitGenerationProgress(jobId, {
              phase: 'chapter_generation',
              chapterNumber,
              status: 'continuity_validation',
              details: `Validating continuity for chapter ${chapterNumber}`
            });
            
            continuityValidation = continuityGuardian.validateChapter(chapterContent, chapterNumber);
            if (!continuityValidation.isValid) {
              logger.warn(`Continuity issues detected in chapter ${chapterNumber}:`, continuityValidation.issues);
            }
            
            // Update story bible with this chapter's information
            const chapterAnalysis = continuityGuardian.analyzeChapter(chapterContent, chapterNumber);
            continuityGuardian.updateStoryBible(chapterAnalysis, chapterNumber);
            
            // Emit quality metrics
            emitQualityMetrics(jobId, {
              chapterNumber,
              continuityScore: continuityValidation.isValid ? 100 : Math.max(0, 100 - (continuityValidation.issues.length * 20)),
              issuesFound: continuityValidation.issues.length,
              storyBibleElements: chapterAnalysis
            });
            
          } catch (error) {
            logger.warn(`Continuity validation error for chapter ${chapterNumber}: ${error.message}`);
            // Continue without validation rather than fail
          }
        }
        
        // Calculate cost
        const cost = this.calculateCost(
          'gpt-4o',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        );
        
        // Emit cost tracking
        emitCostTracking(jobId, {
          chapterNumber,
          chapterCost: cost,
          tokensUsed: response.usage.total_tokens,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          model: 'gpt-4o'
        });
        
        // Create chapter object
        const chapter = {
          chapterNumber: chapterNumber,
          title: chapterOutline.title,
          content: chapterContent,
          wordCount: wordCount,
          tokensUsed: response.usage.total_tokens,
          cost: cost,
          attempts: attempts, // This is the parameter passed to the function
          generationTime: Date.now() - chapterStart,
          continuityCheck: continuityValidation // Include continuity validation results
        };
        
        logger.info(`Generated chapter ${chapterNumber} for job ${jobId} (${wordCount} words, attempt ${retryCount})`);
        
        return chapter;
        
      } catch (error) {
        logger.error(`Attempt ${retryCount} failed for chapter ${chapterNumber} in job ${jobId}:`, error);
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to generate chapter ${chapterNumber} after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
  }
  
  async resumeChapterGeneration(jobId, startFromChapter = 1) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    
    // Preserve existing activeJob data or create new with continuityGuardian
    const existingActiveJob = this.activeJobs.get(jobId);
    this.activeJobs.set(jobId, {
      startTime: existingActiveJob?.startTime || Date.now(),
      status: 'writing',
      continuityGuardian: existingActiveJob?.continuityGuardian || new ContinuityGuardian(jobId)
    });
    
    // Update job status
    job.status = 'writing';
    job.currentPhase = 'chapter_writing';
    job.progress.lastActivity = new Date();
    await job.save();
    
    emitJobUpdate(jobId, {
      status: job.status,
      currentPhase: job.currentPhase,
      message: `Resuming chapter generation from chapter ${startFromChapter}...`
    });
    
    try {
      // Find failed or incomplete chapters that need to be regenerated
      const chaptersToRegenerate = job.chapters.filter(ch => 
        ch.chapterNumber >= startFromChapter && 
        (ch.status === 'failed' || ch.status === 'pending')
      );
      
      let totalTokensUsed = 0;
      let totalCost = 0;
      let successCount = 0;
      let failureCount = 0;
      
      for (const chapterSlot of chaptersToRegenerate) {
        const chapterNumber = chapterSlot.chapterNumber;
        const chapterOutline = job.outline.find(o => o.chapterNumber === chapterNumber);
        
        if (!chapterOutline) {
          logger.warn(`No outline found for chapter ${chapterNumber}, skipping`);
          continue;
        }
        
        emitJobUpdate(jobId, {
          currentPhase: 'chapter_writing',
          message: `Regenerating chapter ${chapterNumber}...`,
          progress: {
            chaptersCompleted: job.progress.chaptersCompleted || 0,
            chaptersFailed: job.progress.chaptersFailed || 0,
            totalChapters: job.targetChapters
          }
        });
        
        // Generate the chapter with proper retry logic
        const chapterResult = await this.generateChapterWithRetry(jobId, chapterNumber, chapterOutline);
        
        if (chapterResult.success) {
          // Update successful chapter in database
          await this.updateChapterInDatabase(jobId, chapterResult.chapter);
          
          totalTokensUsed += chapterResult.chapter.tokensUsed || 0;
          totalCost += chapterResult.chapter.cost || 0;
          successCount++;
          
          // Update progress counters
          if (chapterSlot.status === 'failed') {
            job.progress.chaptersFailed = Math.max(0, (job.progress.chaptersFailed || 0) - 1);
            // Remove from failed chapters list
            if (job.progress.failedChapterNumbers) {
              job.progress.failedChapterNumbers = job.progress.failedChapterNumbers.filter(n => n !== chapterNumber);
            }
          }
          job.progress.chaptersCompleted = (job.progress.chaptersCompleted || 0) + 1;
          
          emitJobUpdate(jobId, {
            currentPhase: 'chapter_writing',
            progress: {
              chaptersCompleted: job.progress.chaptersCompleted,
              chaptersFailed: job.progress.chaptersFailed || 0,
              totalChapters: job.targetChapters
            },
            message: `Chapter ${chapterNumber} regenerated successfully. ${job.progress.chaptersCompleted}/${job.targetChapters} chapters done.`
          });
          
        } else {
          // Mark as failed again
          await this.markChapterAsFailed(jobId, chapterNumber, chapterResult.error);
          failureCount++;
          
          emitJobUpdate(jobId, {
            currentPhase: 'chapter_writing',
            progress: {
              chaptersCompleted: job.progress.chaptersCompleted || 0,
              chaptersFailed: job.progress.chaptersFailed || 0,
              totalChapters: job.targetChapters
            },
            message: `Chapter ${chapterNumber} failed again after ${chapterResult.attempts} attempts.`
          });
        }
        
        await job.save();
        
        // Small delay between chapters
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update final status
      const completedChapters = job.chapters.filter(ch => ch.status === 'completed').length;
      const failedChapters = job.chapters.filter(ch => ch.status === 'failed').length;
      
      job.progress.hasFailures = failedChapters > 0;
      job.progress.lastActivity = new Date();
      
      if (completedChapters === job.targetChapters) {
        // All chapters completed
        job.status = 'completed';
        job.currentPhase = 'completed';
        
        emitJobUpdate(jobId, {
          status: 'completed',
          currentPhase: 'completed',
          message: `Novel generation completed successfully! Regenerated ${successCount} chapters.`,
          progress: job.progress
        });
        
      } else if (completedChapters > 0) {
        // Partial success
        job.status = 'completed';
        job.currentPhase = 'completed';
        job.error = `Novel completed with ${failedChapters} failed chapters. ${successCount} chapters were successfully regenerated.`;
        
        emitJobUpdate(jobId, {
          status: 'completed',
          currentPhase: 'completed',
          message: `Regeneration completed: ${successCount} successful, ${failureCount} failed. ${completedChapters}/${job.targetChapters} total chapters completed.`,
          progress: job.progress
        });
        
      } else {
        // Complete failure
        job.status = 'failed';
        job.error = `Chapter regeneration failed. No chapters could be completed.`;
        
        emitJobUpdate(jobId, {
          status: 'failed',
          message: `Chapter regeneration failed for all attempted chapters.`,
          progress: job.progress
        });
      }
      
      await job.save();
      this.activeJobs.delete(jobId);
      
      logger.info(`Completed resuming chapter generation for job ${jobId}: ${successCount} successful, ${failureCount} failed`);
      
    } catch (error) {
      await this.handleGenerationError(jobId, error);
    }
  }
  
  async handleOpenAIError(error, jobId, phase) {
    logger.error(`OpenAI API error in ${phase} for job ${jobId}:`, error);
    
    // Handle specific OpenAI API errors with appropriate strategies
    if (error.status === 429) {
      // Rate limit error - implement exponential backoff
      logger.warn(`Rate limit hit for job ${jobId}, will retry with backoff`);
      return true;
    } else if (error.status === 500 || error.status === 503) {
      // Server error - retry with backoff
      logger.warn(`OpenAI server error for job ${jobId}, will retry`);
      return true;
    } else if (error.status === 400 && error.message?.includes('context_length_exceeded')) {
      // Context length error - need to reduce input
      logger.error(`Context length exceeded for job ${jobId}, cannot retry`);
      return false;
    } else if (error.status === 401) {
      // Authentication error
      logger.error(`Invalid API key for job ${jobId}`);
      return false;
    }
    
    // For other errors, don't retry automatically
    return false;
  }
  
  async handleGenerationError(jobId, error, phase = null) {
    logger.error(`Error in generation for job ${jobId}:`, error);
    
    try {
      const job = await Job.findById(jobId);
      if (job) {
        job.status = 'failed';
        // Keep the current phase instead of setting invalid 'error'
        job.error = {
          message: error.message,
          phase: phase || job.currentPhase,
          timestamp: new Date()
        };
        job.progress.lastActivity = new Date();
        await job.save();
        
        emitJobUpdate(jobId, {
          status: 'failed',
          currentPhase: job.currentPhase,
          error: error.message,
          message: `Generation failed: ${error.message}`
        });
      }
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
    } catch (dbError) {
      logger.error(`Error updating job ${jobId} after generation error:`, dbError);
    }
  }
  
  calculateCost(model, promptTokens, completionTokens) {
    const rates = this.costTracking[model];
    if (!rates) return 0;
    
    return (promptTokens * rates.inputCost / 1000) + (completionTokens * rates.outputCost / 1000);
  }
  
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  // Extract JSON from OpenAI response that may contain extra text
  extractJSON(content) {
    if (!content) throw new Error('Empty response from OpenAI');
    
    try {
      // First try direct JSON parsing
      return JSON.parse(content);
    } catch (error) {
      // Look for JSON within the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          logger.error('Failed to parse extracted JSON:', jsonMatch[0]);
          throw new Error(`Invalid JSON in response: ${innerError.message}`);
        }
      }
      
      logger.error('No valid JSON found in OpenAI response:', content);
      throw new Error('OpenAI response does not contain valid JSON');
    }
  }
  
  // Get active job status
  getActiveJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }
  
  // Get all active jobs
  getActiveJobs() {
    return Array.from(this.activeJobs.entries()).map(([jobId, status]) => ({
      jobId,
      ...status
    }));
  }
}

module.exports = new AIService();
