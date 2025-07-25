const express = require('express');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Job = require('../models/job');
const aiService = require('../services/aiService');
const logger = require('../logger');
const genreInstructions = require('../shared/genreInstructions');

const router = express.Router();

// Rate limiting for novel generation
const generateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    error: 'Too many novel generation requests. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for other endpoints
const generalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: {
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for premise file uploads with strict validation
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (reduced from 10MB)
    fieldSize: 1024 * 1024, // 1MB field limit
    files: 1 // Only 1 file allowed
  },
  fileFilter: (req, file, cb) => {
    // Strict file type validation
    const allowedMimes = ['text/plain', 'text/markdown'];
    const allowedExtensions = ['.txt', '.md'];
    
    const hasValidMime = allowedMimes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidMime && hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .md files are allowed'), false);
    }
  }
});

// Input sanitization and validation middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.title) {
    req.body.title = req.body.title.trim().replace(/[<>]/g, '');
  }
  if (req.body.premise) {
    req.body.premise = req.body.premise.trim();
  }
  next();
};

// Validation middleware for novel generation
const validateNovelGeneration = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be 1-200 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,:!?'"()]+$/)
    .withMessage('Title contains invalid characters'),
    
  body('premise')
    .isLength({ min: 50, max: 30000 })
    .withMessage('Premise must be 50-30,000 characters (approximately 5,000 words)')
    .trim(),
    
  body('genre')
    .isIn(Object.keys(genreInstructions))
    .withMessage('Invalid genre selected'),
    
  body('targetWordCount')
    .isInt({ min: 10000, max: 500000 })
    .withMessage('Target word count must be between 10,000 and 500,000')
    .toInt(),
    
  body('targetChapters')
    .isInt({ min: 3, max: 100 })
    .withMessage('Target chapters must be between 3 and 100')
    .toInt(),
    
  body('subgenre')
    .custom((value, { req }) => {
      const genre = req.body.genre;
      if (!genre) {
        throw new Error('Genre must be specified before subgenre');
      }
      
      if (!genreInstructions[genre]) {
        throw new Error('Invalid genre');
      }
      
      if (!genreInstructions[genre][value]) {
        throw new Error('Invalid subgenre for selected genre');
      }
      
      return true;
    }),
    
  // Cross-field validation
  body('targetWordCount')
    .custom((value, { req }) => {
      const chapters = parseInt(req.body.targetChapters);
      if (chapters) {
        const avgChapterLength = value / chapters;
        if (avgChapterLength < 500) {
          throw new Error('Average chapter length would be too short (minimum 500 words per chapter)');
        }
        if (avgChapterLength > 10000) {
          throw new Error('Average chapter length would be too long (maximum 10,000 words per chapter)');
        }
      }
      return true;
    })
];

// Validation for job ID parameter
const validateJobId = [
  param('jobId')
    .isMongoId()
    .withMessage('Invalid job ID format')
];

// Error handling middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Concurrent job limit check
const checkConcurrentJobs = async (req, res, next) => {
  try {
    const maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
    const activeJobs = await Job.countDocuments({
      status: { $in: ['planning', 'outlining', 'writing'] }
    });
    
    if (activeJobs >= maxConcurrentJobs) {
      return res.status(429).json({
        error: 'Server is at capacity',
        message: `Maximum ${maxConcurrentJobs} concurrent novel generations allowed. Please try again later.`,
        activeJobs: activeJobs
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking concurrent jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/novel/genres - Get available genres and subgenres
router.get('/genres', generalRateLimit, (req, res) => {
  try {
    const genres = Object.keys(genreInstructions).map(genreName => ({
      name: genreName,
      displayName: genreName.replace(/_/g, ' '),
      subgenres: Object.keys(genreInstructions[genreName]).map(subgenreName => ({
        name: subgenreName,
        displayName: subgenreName.replace(/_/g, ' '),
        description: genreInstructions[genreName][subgenreName]
      }))
    }));
    
    res.json(genres);
  } catch (error) {
    logger.error('Error fetching genres:', error);
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

// POST /api/novel/generate - Start novel generation
router.post('/generate', 
  generateRateLimit,
  sanitizeInput,
  validateNovelGeneration,
  handleValidationErrors,
  checkConcurrentJobs,
  async (req, res) => {
    try {
      console.log('Received request body:', JSON.stringify(req.body, null, 2));
      const { title, premise, genre, subgenre, targetWordCount, targetChapters } = req.body;
      
      // Additional business logic validation
      if (targetWordCount / targetChapters < 500) {
        return res.status(400).json({
          error: 'Configuration error',
          message: 'Average chapter length would be too short (minimum 500 words per chapter)'
        });
      }
      
      // Create new job
      const job = new Job({
        title,
        premise,
        genre,
        subgenre,
        targetWordCount,
        targetChapters,
        status: 'planning',
        currentPhase: 'premise_analysis',
        progress: {
          outlineComplete: false,
          chaptersCompleted: 0,
          totalChapters: targetChapters,
          lastActivity: new Date()
        },
        outline: [],
        chapters: [],
        modelUsage: {
          premiseAnalysis: null,
          outlineGeneration: null,
          chapterGeneration: null
        },
        createdAt: new Date()
      });
      
      await job.save();
      
      // Start generation process asynchronously
      setImmediate(() => {
        aiService.generateNovel(job._id.toString()).catch(error => {
          logger.error(`Novel generation failed for job ${job._id}:`, error);
        });
      });
      
      logger.info(`Started novel generation for job ${job._id}`);
      
      res.status(201).json({
        jobId: job._id,
        message: 'Novel generation started',
        estimatedTime: Math.round((targetWordCount / 1000) * 2) + ' minutes' // Rough estimate
      });
      
    } catch (error) {
      logger.error('Error starting novel generation:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Invalid input data',
          details: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({ error: 'Failed to start novel generation' });
    }
  }
);

// POST /api/novel/upload-premise - Upload premise from file
router.post('/upload-premise',
  generalRateLimit,
  upload.single('premise'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const fileContent = req.file.buffer.toString('utf8');
      
      // Validate file content
      if (fileContent.length < 50) {
        return res.status(400).json({ 
          error: 'File content too short',
          message: 'Premise must be at least 50 characters long'
        });
      }
      
      if (fileContent.length > 30000) {
        return res.status(400).json({ 
          error: 'File content too long',
          message: 'Premise must be less than 30,000 characters (approximately 5,000 words)'
        });
      }
      
      // Basic content validation
      const wordCount = fileContent.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount < 10) {
        return res.status(400).json({
          error: 'Insufficient content',
          message: 'Premise must contain at least 10 words'
        });
      }
      
      res.json({
        premise: fileContent.trim(),
        wordCount: wordCount,
        characterCount: fileContent.length
      });
      
    } catch (error) {
      logger.error('Error uploading premise:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large',
          message: 'File size must be less than 5MB'
        });
      }
      
      if (error.message.includes('Only .txt and .md files')) {
        return res.status(400).json({ 
          error: 'Invalid file type',
          message: 'Only .txt and .md files are allowed'
        });
      }
      
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  }
);

// GET /api/novel/status/:jobId - Get job status
router.get('/status/:jobId',
  generalRateLimit,
  validateJobId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findById(jobId).select('-__v');
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Calculate progress percentage
      let progressPercentage = 0;
      if (job.status === 'completed') {
        progressPercentage = 100;
      } else if (job.currentPhase === 'premise_analysis') {
        progressPercentage = 10;
      } else if (job.currentPhase === 'outline_generation') {
        progressPercentage = 25;
      } else if (job.currentPhase === 'chapter_writing') {
        progressPercentage = 25 + (job.progress.chaptersCompleted / job.targetChapters) * 70;
      }
      
      const response = {
        jobId: job._id,
        status: job.status,
        currentPhase: job.currentPhase,
        progress: {
          ...job.progress,
          percentage: Math.round(progressPercentage)
        },
        title: job.title,
        genre: job.genre,
        subgenre: job.subgenre,
        targetWordCount: job.targetWordCount,
        targetChapters: job.targetChapters,
        createdAt: job.createdAt
      };
      
      // Include outline if available
      if (job.outline && job.outline.length > 0) {
        response.outline = job.outline;
      }
      
      // Include error if failed
      if (job.status === 'failed' && job.error) {
        response.error = job.error;
      }
      
      // Include quality metrics if completed
      if (job.status === 'completed' && job.qualityMetrics) {
        response.qualityMetrics = job.qualityMetrics;
      }
      
      // Include failure information if present
      if (job.progress.hasFailures) {
        response.failures = {
          hasFailures: true,
          failedCount: job.progress.chaptersFailed || 0,
          failedChapters: job.progress.failedChapterNumbers || [],
          canRetry: true
        };
      }
      
      res.json(response);
      
    } catch (error) {
      logger.error('Error fetching job status:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  }
);

// GET /api/novel/download/:jobId - Download completed novel
router.get('/download/:jobId',
  generalRateLimit,
  validateJobId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findById(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      if (job.status !== 'completed') {
        return res.status(400).json({ 
          error: 'Novel not ready',
          message: 'Novel generation is not yet complete',
          currentStatus: job.status
        });
      }
      
      if (!job.chapters || job.chapters.length === 0) {
        return res.status(400).json({ 
          error: 'No content available',
          message: 'No chapters were generated'
        });
      }
      
      // Calculate total word count from completed chapters only
      const completedChapters = job.chapters.filter(ch => ch.status === 'completed');
      const totalWordCount = completedChapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0);
      
      // Separate completed and failed chapters for the response
      const completedChapterData = completedChapters.map(chapter => ({
        number: chapter.chapterNumber,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount
      }));
      
      const failedChapters = job.chapters.filter(ch => ch.status === 'failed').map(chapter => ({
        number: chapter.chapterNumber,
        title: chapter.title,
        failureReason: chapter.failureReason,
        attempts: chapter.attempts,
        lastAttemptAt: chapter.lastAttemptAt
      }));
      
      const novelData = {
        id: job._id,
        title: job.title,
        genre: job.genre,
        subgenre: job.subgenre,
        premise: job.premise,
        chapters: completedChapterData,
        failedChapters: failedChapters,
        wordCount: totalWordCount,
        targetWordCount: job.targetWordCount,
        completedAt: job.progress.lastActivity,
        qualityMetrics: job.qualityMetrics || null,
        hasFailures: job.progress.hasFailures || false,
        completionStats: {
          completed: completedChapters.length,
          failed: failedChapters.length,
          total: job.targetChapters,
          completionRate: Math.round((completedChapters.length / job.targetChapters) * 100)
        }
      };
      
      res.json(novelData);
      
    } catch (error) {
      logger.error('Error downloading novel:', error);
      res.status(500).json({ error: 'Failed to download novel' });
    }
  }
);

// GET /api/novel/jobs - List user's jobs (if authentication is implemented)
router.get('/jobs',
  generalRateLimit,
  async (req, res) => {
    try {
      // For now, return recent jobs (in production, filter by user)
      const jobs = await Job.find({})
        .select('_id title status currentPhase createdAt progress.chaptersCompleted targetChapters')
        .sort({ createdAt: -1 })
        .limit(10);
      
      const jobList = jobs.map(job => ({
        jobId: job._id,
        title: job.title,
        status: job.status,
        currentPhase: job.currentPhase,
        progress: job.progress?.chaptersCompleted || 0,
        totalChapters: job.targetChapters,
        createdAt: job.createdAt
      }));
      
      res.json({ jobs: jobList });
      
    } catch (error) {
      logger.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

// DELETE /api/novel/:jobId - Cancel/delete a job
router.delete('/:jobId',
  generalRateLimit,
  validateJobId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findById(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // If job is active (planning, analysis, outlining, writing), cancel it
      const activeStatuses = ['planning', 'analysis', 'outlining', 'writing'];
      if (activeStatuses.includes(job.status)) {
        logger.info(`Cancelling active job ${jobId}`);
        
        // Mark job as cancelled
        job.status = 'failed';
        job.currentPhase = 'cancelled';
        job.error = 'Job cancelled by user';
        job.progress.lastActivity = new Date();
        await job.save();
        
        return res.json({ 
          message: 'Job cancelled successfully',
          status: 'cancelled' 
        });
      }
      
      // For completed/failed jobs, delete them
      const deletableStatuses = ['pending', 'failed', 'completed'];
      if (deletableStatuses.includes(job.status)) {
        await Job.findByIdAndDelete(jobId);
        logger.info(`Deleted job ${jobId}`);
        return res.json({ message: 'Job deleted successfully' });
      }
      
      // Shouldn't reach here, but handle edge case
      return res.status(400).json({ 
        error: 'Cannot process job',
        message: `Job status: ${job.status}`
      });
      
    } catch (error) {
      logger.error('Error cancelling/deleting job:', error);
      res.status(500).json({ error: 'Failed to cancel/delete job' });
    }
  }
);

// POST /api/novel/retry/:jobId - Retry failed chapters
router.post('/retry/:jobId',
  generalRateLimit,
  validateJobId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const { chapterNumbers } = req.body; // Optional: specific chapters to retry
      
      const job = await Job.findById(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Check if job has failed chapters
      const failedChapters = job.chapters.filter(ch => ch.status === 'failed');
      
      if (failedChapters.length === 0) {
        return res.status(400).json({
          error: 'No failed chapters',
          message: 'This job has no failed chapters to retry'
        });
      }
      
      // Check if job is currently processing
      if (['planning', 'outlining', 'writing'].includes(job.status)) {
        return res.status(400).json({
          error: 'Job is active',
          message: 'Cannot retry chapters while job is still processing'
        });
      }
      
      // Filter chapters to retry
      let chaptersToRetry = failedChapters;
      if (chapterNumbers && Array.isArray(chapterNumbers)) {
        chaptersToRetry = failedChapters.filter(ch => chapterNumbers.includes(ch.chapterNumber));
        
        if (chaptersToRetry.length === 0) {
          return res.status(400).json({
            error: 'No matching failed chapters',
            message: 'None of the specified chapters are in failed status'
          });
        }
      }
      
      // Start retry process asynchronously
      const startFromChapter = Math.min(...chaptersToRetry.map(ch => ch.chapterNumber));
      
      setImmediate(() => {
        aiService.resumeChapterGeneration(jobId, startFromChapter).catch(error => {
          logger.error(`Chapter retry failed for job ${jobId}:`, error);
        });
      });
      
      logger.info(`Started chapter retry for job ${jobId}, chapters: ${chaptersToRetry.map(ch => ch.chapterNumber).join(', ')}`);
      
      res.json({
        message: 'Chapter retry started',
        chaptersToRetry: chaptersToRetry.length,
        chapterNumbers: chaptersToRetry.map(ch => ch.chapterNumber),
        estimatedTime: Math.round(chaptersToRetry.length * 3) + ' minutes'
      });
      
    } catch (error) {
      logger.error('Error starting chapter retry:', error);
      res.status(500).json({ error: 'Failed to start chapter retry' });
    }
  }
);

// GET /api/novel/failures/:jobId - Get detailed information about failed chapters
router.get('/failures/:jobId',
  generalRateLimit,
  validateJobId,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findById(jobId).select('title chapters progress qualityMetrics');
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const failedChapters = job.chapters.filter(ch => ch.status === 'failed');
      const completedChapters = job.chapters.filter(ch => ch.status === 'completed');
      
      const failureDetails = failedChapters.map(chapter => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        status: chapter.status,
        attempts: chapter.attempts,
        failureReason: chapter.failureReason,
        lastAttemptAt: chapter.lastAttemptAt
      }));
      
      res.json({
        jobId: job._id,
        title: job.title,
        failedChapters: failureDetails,
        summary: {
          totalChapters: job.chapters.length,
          completed: completedChapters.length,
          failed: failedChapters.length,
          canRetry: failedChapters.length > 0,
          completionRate: Math.round((completedChapters.length / job.chapters.length) * 100)
        }
      });
      
    } catch (error) {
      logger.error('Error fetching failure details:', error);
      res.status(500).json({ error: 'Failed to fetch failure details' });
    }
  }
);

// ========================================
// MONITORING & TRANSPARENCY API ENDPOINTS
// ========================================

// Get story bible data for a job
router.get('/story-bible/:jobId',
  generalRateLimit,
  [
    param('jobId').isMongoId().withMessage('Valid job ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const job = await Job.findById(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Extract story bible from job metadata
      const storyBible = job.metadata?.storyBible || {
        characters: {},
        plotThreads: [],
        timeline: [],
        locations: {},
        themes: []
      };

      res.json({
        jobId: req.params.jobId,
        storyBible,
        lastUpdated: job.updatedAt
      });

    } catch (error) {
      logger.error('Error fetching story bible:', error);
      res.status(500).json({ 
        error: 'Failed to fetch story bible',
        message: 'Internal server error'
      });
    }
  }
);

// Get continuity alerts for a job
router.get('/continuity-alerts/:jobId',
  generalRateLimit,
  [
    param('jobId').isMongoId().withMessage('Valid job ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const job = await Job.findById(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Extract continuity alerts from job metadata
      const alerts = job.metadata?.continuityAlerts || [];

      res.json({
        jobId: req.params.jobId,
        alerts,
        totalCount: alerts.length,
        lastChecked: job.updatedAt
      });

    } catch (error) {
      logger.error('Error fetching continuity alerts:', error);
      res.status(500).json({ 
        error: 'Failed to fetch continuity alerts',
        message: 'Internal server error'
      });
    }
  }
);

// Get quality metrics for a job
router.get('/quality-metrics/:jobId',
  generalRateLimit,
  [
    param('jobId').isMongoId().withMessage('Valid job ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const job = await Job.findById(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Extract quality metrics from job metadata
      const metrics = job.metadata?.enhancedQualityMetrics || {
        humanLikenessScore: 0,
        complexityScore: 0,
        consistencyScore: 0,
        creativityScore: 0
      };

      res.json({
        jobId: req.params.jobId,
        metrics,
        lastUpdated: job.updatedAt
      });

    } catch (error) {
      logger.error('Error fetching quality metrics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch quality metrics',
        message: 'Internal server error'
      });
    }
  }
);

// Get cost tracking data for a job
router.get('/cost-tracking/:jobId',
  generalRateLimit,
  [
    param('jobId').isMongoId().withMessage('Valid job ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const job = await Job.findById(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Extract cost tracking from job metadata
      const costTracking = job.metadata?.costTracking || {
        totalCost: 0,
        tokensUsed: 0,
        estimatedRemaining: 0,
        breakdown: {
          analysis: 0,
          outline: 0,
          chapters: 0
        }
      };

      res.json({
        jobId: req.params.jobId,
        costTracking,
        lastUpdated: job.updatedAt
      });

    } catch (error) {
      logger.error('Error fetching cost tracking:', error);
      res.status(500).json({ 
        error: 'Failed to fetch cost tracking',
        message: 'Internal server error'
      });
    }
  }
);

// Get all monitoring data for a job (comprehensive endpoint)
router.get('/monitoring/:jobId',
  generalRateLimit,
  [
    param('jobId').isMongoId().withMessage('Valid job ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const job = await Job.findById(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Compile comprehensive monitoring data
      const monitoring = {
        jobId: req.params.jobId,
        status: job.status,
        currentPhase: job.currentPhase,
        lastUpdated: job.updatedAt,
        storyBible: job.metadata?.storyBible || {
          characters: {},
          plotThreads: [],
          timeline: [],
          locations: {},
          themes: []
        },
        continuityAlerts: job.metadata?.continuityAlerts || [],
        qualityMetrics: job.metadata?.enhancedQualityMetrics || {
          humanLikenessScore: 0,
          complexityScore: 0,
          consistencyScore: 0,
          creativityScore: 0
        },
        costTracking: job.metadata?.costTracking || {
          totalCost: 0,
          tokensUsed: 0,
          estimatedRemaining: 0,
          breakdown: {
            analysis: 0,
            outline: 0,
            chapters: 0
          }
        },
        enhancementsApplied: job.metadata?.enhancementsApplied || [],
        aiDecisions: job.metadata?.aiDecisions || [],
        systemHealth: {
          status: job.status,
          lastUpdate: job.updatedAt,
          performance: job.metadata?.performance || {}
        },
        generationProgress: {
          currentStep: job.metadata?.currentStep || '',
          percentage: job.progress?.percentage || 0,
          estimatedTimeRemaining: job.metadata?.estimatedTimeRemaining || null,
          lastActivity: job.updatedAt
        }
      };

      res.json(monitoring);

    } catch (error) {
      logger.error('Error fetching comprehensive monitoring data:', error);
      res.status(500).json({ 
        error: 'Failed to fetch monitoring data',
        message: 'Internal server error'
      });
    }
  }
);

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Route error:', error);
  
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body exceeds size limit'
    });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
