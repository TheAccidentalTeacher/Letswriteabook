// healthRoutes.js - Comprehensive health check and monitoring endpoints
const express = require('express');
const mongoose = require('mongoose');
const logger = require('../logger');
const performanceMonitor = require('../middleware/performanceMonitor');
const { databaseManager } = require('../mongodb');
const recoveryService = require('../services/recoveryService');

const router = express.Router();

/**
 * Basic health check - lightweight endpoint for load balancers
 * GET /health
 */
router.get('/', (req, res) => {
  // Always return 200 for Railway healthcheck
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Detailed health check with dependency status
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkDiskSpace(),
      checkMemory(),
      checkRecoveryService()
    ]);

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', error: checks[0].reason?.message },
        disk: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', error: checks[1].reason?.message },
        memory: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', error: checks[2].reason?.message },
        recovery: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'error', error: checks[3].reason?.message }
      }
    };

    // Determine overall status
    const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
    const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');
    
    if (hasErrors) {
      health.status = 'error';
    } else if (hasWarnings) {
      health.status = 'warning';
    }

    const statusCode = health.status === 'error' ? 503 : 200;
    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error.message
    });
  }
});

/**
 * Performance metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Performance health status
 * GET /health/performance
 */
router.get('/performance', (req, res) => {
  try {
    const healthStatus = performanceMonitor.getHealthStatus();
    const statusCode = healthStatus.status === 'unhealthy' ? 503 : 
                      healthStatus.status === 'degraded' ? 200 : 200;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Failed to get performance health:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve performance health'
    });
  }
});

/**
 * Database health check
 * GET /health/database
 */
router.get('/database', async (req, res) => {
  try {
    const dbHealth = await checkDatabase();
    const statusCode = dbHealth.status === 'error' ? 503 : 200;
    
    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      ...dbHealth
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Database health check failed',
      message: error.message
    });
  }
});

/**
 * Recovery service health check
 * GET /health/recovery
 */
router.get('/recovery', async (req, res) => {
  try {
    const recoveryHealth = await checkRecoveryService();
    const statusCode = recoveryHealth.status === 'error' ? 503 : 200;
    
    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      ...recoveryHealth
    });
  } catch (error) {
    logger.error('Recovery service health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Recovery service health check failed',
      message: error.message
    });
  }
});

/**
 * System resources health check
 * GET /health/system
 */
router.get('/system', async (req, res) => {
  try {
    const [memory, disk] = await Promise.all([
      checkMemory(),
      checkDiskSpace()
    ]);

    const system = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      memory,
      disk,
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: require('os').loadavg?.() || 'N/A'
      },
      uptime: {
        process: process.uptime(),
        system: require('os').uptime()
      }
    };

    // Determine overall system status
    if (memory.status === 'error' || disk.status === 'error') {
      system.status = 'error';
    } else if (memory.status === 'warning' || disk.status === 'warning') {
      system.status = 'warning';
    }

    const statusCode = system.status === 'error' ? 503 : 200;
    res.status(statusCode).json(system);

  } catch (error) {
    logger.error('System health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'System health check failed',
      message: error.message
    });
  }
});

/**
 * Readiness probe - checks if service is ready to accept traffic
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const dbReady = await isDatabaseReady();
    const envReady = areEnvironmentVariablesReady();
    
    const ready = {
      ready: dbReady && envReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbReady,
        environment: envReady
      }
    };

    const statusCode = ready.ready ? 200 : 503;
    res.status(statusCode).json(ready);

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      message: error.message
    });
  }
});

/**
 * Liveness probe - checks if service is alive
 * GET /health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * Startup probe - checks if service has started successfully
 * GET /health/startup
 */
router.get('/startup', async (req, res) => {
  try {
    const startupTime = process.uptime();
    const minStartupTime = 10; // seconds
    
    const startup = {
      started: startupTime > minStartupTime,
      timestamp: new Date().toISOString(),
      uptime: startupTime,
      minStartupTime: minStartupTime
    };

    const statusCode = startup.started ? 200 : 503;
    res.status(statusCode).json(startup);

  } catch (error) {
    logger.error('Startup check failed:', error);
    res.status(503).json({
      started: false,
      timestamp: new Date().toISOString(),
      error: 'Startup check failed',
      message: error.message
    });
  }
});

// Helper functions

/**
 * Check database connectivity and performance
 */
async function checkDatabase() {
  try {
    const startTime = Date.now();
    
    // Test basic connectivity
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'error',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      };
    }

    // Test database operations
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    
    // Get database stats if available
    let stats = null;
    try {
      if (databaseManager) {
        stats = await databaseManager.getDatabaseStats();
      }
    } catch (error) {
      logger.debug('Could not get database stats:', error.message);
    }

    return {
      status: responseTime > 1000 ? 'warning' : 'ok',
      responseTime: responseTime,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      stats: stats
    };

  } catch (error) {
    logger.error('Database health check error:', error);
    return {
      status: 'error',
      message: error.message,
      readyState: mongoose.connection.readyState
    };
  }
}

/**
 * Check memory usage
 */
async function checkMemory() {
  try {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    const systemMemoryUsedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    let status = 'ok';
    if (heapUsedPercent > 90 || systemMemoryUsedPercent > 90) {
      status = 'error';
    } else if (heapUsedPercent > 80 || systemMemoryUsedPercent > 80) {
      status = 'warning';
    }

    return {
      status,
      usage: {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      },
      percentages: {
        heap: Math.round(heapUsedPercent),
        system: Math.round(systemMemoryUsedPercent)
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024)
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Check disk space (basic implementation)
 */
async function checkDiskSpace() {
  try {
    const fs = require('fs').promises;
    const stats = await fs.statfs('.');
    
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    const usedPercent = (used / total) * 100;
    
    let status = 'ok';
    if (usedPercent > 90) {
      status = 'error';
    } else if (usedPercent > 80) {
      status = 'warning';
    }

    return {
      status,
      total: Math.round(total / 1024 / 1024 / 1024), // GB
      free: Math.round(free / 1024 / 1024 / 1024), // GB
      used: Math.round(used / 1024 / 1024 / 1024), // GB
      usedPercent: Math.round(usedPercent)
    };

  } catch (error) {
    // Fallback if statfs is not available
    return {
      status: 'ok',
      message: 'Disk space check not available on this platform'
    };
  }
}

/**
 * Check recovery service status
 */
async function checkRecoveryService() {
  try {
    const healthStatus = recoveryService.getHealthStatus();
    
    let status = 'ok';
    if (!healthStatus.isRunning) {
      status = 'error';
    } else if (healthStatus.activeRecoveries > 5) {
      status = 'warning';
    }

    return {
      status,
      ...healthStatus
    };

  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Check if database is ready for operations
 */
async function isDatabaseReady() {
  try {
    return mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Check if required environment variables are present
 */
function areEnvironmentVariablesReady() {
  const required = ['OPENAI_API_KEY', 'MONGODB_URI'];
  return required.every(varName => process.env[varName]);
}

module.exports = router;
