// Admin script to clean up stuck jobs
const express = require('express');
const router = express.Router();
const Job = require('../models/job');

// EMERGENCY: Kill ALL active jobs immediately (admin endpoint)
router.get('/kill-all-jobs', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Killing ALL active jobs...');
    
    // Find ALL active jobs regardless of time
    const activeJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'analysis', 'outlining', 'writing', 'chapter_writing'] }
    });
    
    console.log(`🚨 Found ${activeJobs.length} active jobs to kill`);
    
    // Kill them ALL immediately
    const updateResult = await Job.updateMany(
      {
        status: { $in: ['pending', 'planning', 'analysis', 'outlining', 'writing', 'chapter_writing'] }
      },
      {
        $set: {
          status: 'failed',
          currentPhase: 'cancelled',
          error: 'EMERGENCY KILL: Job forcibly cancelled to prevent FUBAR situation',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`🚨 KILLED ${updateResult.modifiedCount} active jobs`);
    
    // Send HTML response for browser viewing
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚨 EMERGENCY KILL COMPLETE</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 40px; 
          background: #f5f5f5; 
          text-align: center;
        }
        .success { 
          background: #d4edda; 
          color: #155724; 
          padding: 20px; 
          border: 1px solid #c3e6cb; 
          border-radius: 8px;
          font-size: 18px;
          margin: 20px 0;
        }
        .stats {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <h1>🚨 EMERGENCY KILL COMPLETE</h1>
      
      <div class="success">
        <h2>✅ ALL ZOMBIE JOBS ELIMINATED!</h2>
        <p><strong>Killed Jobs:</strong> ${updateResult.modifiedCount}</p>
        <p><strong>Available Slots:</strong> 3/3</p>
        <p><strong>Status:</strong> You are UN-FUBAR'd! 🎉</p>
      </div>
      
      <div class="stats">
        <h3>What Happened:</h3>
        <ul style="text-align: left; max-width: 600px; margin: 0 auto;">
          <li>Found ${activeJobs.length} zombie jobs burning your credits</li>
          <li>Killed all ${updateResult.modifiedCount} active jobs immediately</li>
          <li>Freed up all concurrent job slots</li>
          <li>Stopped background AI generation processes</li>
        </ul>
      </div>
      
      <h2>🎯 You can now generate novels again!</h2>
      <p><a href="/">← Go back to generator</a></p>
    </body>
    </html>`;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error killing jobs:', error);
    
    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>❌ KILL FAILED</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>❌ EMERGENCY KILL FAILED</h1>
      <div class="error">
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please try again or contact support.</p>
      </div>
    </body>
    </html>`;
    
    res.status(500).send(errorHtml);
  }
});

// EMERGENCY: Kill ALL active jobs immediately (POST version for API calls)
router.post('/kill-all-jobs', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Killing ALL active jobs...');
    
    // Find ALL active jobs regardless of time
    const activeJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'analysis', 'outlining', 'writing', 'chapter_writing'] }
    });
    
    console.log(`🚨 Found ${activeJobs.length} active jobs to kill`);
    
    // Kill them ALL immediately
    const updateResult = await Job.updateMany(
      {
        status: { $in: ['pending', 'planning', 'analysis', 'outlining', 'writing', 'chapter_writing'] }
      },
      {
        $set: {
          status: 'failed',
          currentPhase: 'cancelled',
          error: 'EMERGENCY KILL: Job forcibly cancelled to prevent FUBAR situation',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`🚨 KILLED ${updateResult.modifiedCount} active jobs`);
    
    // Send immediate response
    res.json({
      success: true,
      message: `EMERGENCY KILL COMPLETE: Cancelled ${updateResult.modifiedCount} active jobs`,
      killedJobs: updateResult.modifiedCount,
      availableSlots: 3
    });
    
  } catch (error) {
    console.error('Error killing jobs:', error);
    res.status(500).json({ 
      error: 'Failed to kill jobs', 
      details: error.message 
    });
  }
});

// Clean up stuck jobs (admin endpoint)
router.post('/cleanup-stuck-jobs', async (req, res) => {
  try {
    console.log('Starting cleanup of stuck jobs...');
    
    // Find jobs that are stuck in active states for more than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const stuckJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] },
      updatedAt: { $lt: twoHoursAgo }
    });
    
    console.log(`Found ${stuckJobs.length} stuck jobs`);
    
    // Mark them as failed
    const updateResult = await Job.updateMany(
      {
        status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] },
        updatedAt: { $lt: twoHoursAgo }
      },
      {
        $set: {
          status: 'failed',
          error: 'Job automatically cleaned up due to being stuck for more than 2 hours',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} stuck jobs`);
    
    // Also check for any jobs stuck for less than 2 hours
    const recentActiveJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] }
    }).select('_id status currentPhase createdAt updatedAt');
    
    // Send HTML response for better visibility
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cleanup Results</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { color: #28a745; font-weight: bold; font-size: 18px; }
        .info { color: #17a2b8; margin: 10px 0; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🛠️ Cleanup Results</h1>
        
        ${updateResult.modifiedCount > 0 ? 
          `<p class="success">✅ Successfully cleaned up ${updateResult.modifiedCount} stuck jobs!</p>` :
          `<p class="info">ℹ️ No stuck jobs found that needed cleanup.</p>`
        }
        
        <div class="info">
          <h3>Summary:</h3>
          <ul>
            <li><strong>Jobs cleaned up:</strong> ${updateResult.modifiedCount}</li>
            <li><strong>Remaining active jobs:</strong> ${recentActiveJobs.length}</li>
            <li><strong>Total slots available:</strong> ${3 - recentActiveJobs.length}/3</li>
          </ul>
        </div>
        
        ${recentActiveJobs.length > 0 ? `
          <div class="warning">
            <h3>⚠️ Remaining Active Jobs:</h3>
            <pre>${JSON.stringify(recentActiveJobs.map(job => ({
              id: job._id,
              status: job.status,
              phase: job.currentPhase,
              ageMinutes: Math.round((Date.now() - job.updatedAt.getTime()) / (1000 * 60))
            })), null, 2)}</pre>
            <p><em>These jobs are less than 2 hours old and were not cleaned up.</em></p>
          </div>
        ` : `
          <p class="success">🎉 All job slots are now free! You can start new novel generations.</p>
        `}
        
        <a href="/" class="back-link">← Back to Novel Generator</a>
        <a href="/api/admin/job-status" class="back-link" style="background: #6c757d;">📊 Check Status Again</a>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error cleaning up stuck jobs:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1 style="color: #dc3545;">❌ Cleanup Error</h1>
          <p>There was an error cleaning up stuck jobs:</p>
          <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px;">${error.message}</pre>
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">← Back to Novel Generator</a>
        </body>
      </html>
    `);
  }
});

// Also make it work with GET requests for easier access
router.get('/cleanup-stuck-jobs', async (req, res) => {
  try {
    console.log('Starting cleanup of stuck jobs via GET...');
    
    // Find jobs that are stuck in active states for more than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const stuckJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] },
      updatedAt: { $lt: twoHoursAgo }
    });
    
    console.log(`Found ${stuckJobs.length} stuck jobs`);
    
    // Mark them as failed
    const updateResult = await Job.updateMany(
      {
        status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] },
        updatedAt: { $lt: twoHoursAgo }
      },
      {
        $set: {
          status: 'failed',
          error: 'Job automatically cleaned up due to being stuck for more than 2 hours',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} stuck jobs`);
    
    // Also check for any jobs stuck for less than 2 hours
    const recentActiveJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] }
    }).select('_id status currentPhase createdAt updatedAt');
    
    // Send HTML response for better visibility
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cleanup Results</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { color: #28a745; font-weight: bold; font-size: 18px; }
        .info { color: #17a2b8; margin: 10px 0; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🛠️ Cleanup Results</h1>
        
        ${updateResult.modifiedCount > 0 ? 
          `<p class="success">✅ Successfully cleaned up ${updateResult.modifiedCount} stuck jobs!</p>` :
          `<p class="info">ℹ️ No stuck jobs found that needed cleanup.</p>`
        }
        
        <div class="info">
          <h3>Summary:</h3>
          <ul>
            <li><strong>Jobs cleaned up:</strong> ${updateResult.modifiedCount}</li>
            <li><strong>Remaining active jobs:</strong> ${recentActiveJobs.length}</li>
            <li><strong>Total slots available:</strong> ${3 - recentActiveJobs.length}/3</li>
          </ul>
        </div>
        
        ${recentActiveJobs.length > 0 ? `
          <div class="warning">
            <h3>⚠️ Remaining Active Jobs:</h3>
            <pre>${JSON.stringify(recentActiveJobs.map(job => ({
              id: job._id,
              status: job.status,
              phase: job.currentPhase,
              ageMinutes: Math.round((Date.now() - job.updatedAt.getTime()) / (1000 * 60))
            })), null, 2)}</pre>
            <p><em>These jobs are less than 2 hours old and were not cleaned up.</em></p>
          </div>
        ` : `
          <p class="success">🎉 All job slots are now free! You can start new novel generations.</p>
        `}
        
        <a href="/" class="back-link">← Back to Novel Generator</a>
        <a href="/api/admin/job-status" class="back-link" style="background: #6c757d;">📊 Check Status Again</a>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error cleaning up stuck jobs:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1 style="color: #dc3545;">❌ Cleanup Error</h1>
          <p>There was an error cleaning up stuck jobs:</p>
          <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px;">${error.message}</pre>
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">← Back to Novel Generator</a>
        </body>
      </html>
    `);
  }
});

// Check current job status (admin endpoint)
router.get('/job-status', async (req, res) => {
  try {
    const activeJobs = await Job.find({
      status: { $in: ['pending', 'planning', 'outlining', 'writing', 'chapter_writing'] }
    }).select('_id status currentPhase createdAt updatedAt');
    
    const completedJobs = await Job.find({
      status: 'completed'
    }).countDocuments();
    
    const failedJobs = await Job.find({
      status: 'failed'
    }).countDocuments();
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Job Status Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-number { font-size: 32px; font-weight: bold; color: #007bff; }
        .stat-label { color: #6c757d; }
        .active-jobs { margin: 20px 0; }
        .job-card { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .job-stuck { background: #f8d7da; border-color: #f5c6cb; }
        .actions { margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; margin: 5px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .btn-danger { background: #dc3545; }
        .btn-secondary { background: #6c757d; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📊 Job Status Dashboard</h1>
        
        <div class="stats">
          <div class="stat-box">
            <div class="stat-number">${activeJobs.length}</div>
            <div class="stat-label">Active Jobs</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${3 - activeJobs.length}</div>
            <div class="stat-label">Available Slots</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${completedJobs}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${failedJobs}</div>
            <div class="stat-label">Failed</div>
          </div>
        </div>
        
        ${activeJobs.length > 0 ? `
          <div class="active-jobs">
            <h2>Active Jobs:</h2>
            ${activeJobs.map(job => {
              const ageMinutes = Math.round((Date.now() - job.updatedAt.getTime()) / (1000 * 60));
              const isStuck = ageMinutes > 120; // More than 2 hours
              
              return `
                <div class="job-card ${isStuck ? 'job-stuck' : ''}">
                  <strong>Job ${job._id}</strong> ${isStuck ? '⚠️ STUCK' : '✅ Active'}
                  <br>Status: ${job.status} (${job.currentPhase})
                  <br>Age: ${ageMinutes} minutes
                  <br>Created: ${job.createdAt}
                  <br>Last Update: ${job.updatedAt}
                </div>
              `;
            }).join('')}
          </div>
        ` : '<p style="color: #28a745; font-size: 18px;">🎉 No active jobs! All slots are free.</p>'}
        
        <div class="actions">
          <h3>Actions:</h3>
          ${activeJobs.some(job => Math.round((Date.now() - job.updatedAt.getTime()) / (1000 * 60)) > 120) ? 
            '<a href="/api/admin/cleanup-stuck-jobs" class="btn btn-danger">🛠️ Clean Up Stuck Jobs</a>' : 
            '<span style="color: #6c757d;">No stuck jobs to clean up</span>'
          }
          <a href="/" class="btn">← Back to Novel Generator</a>
          <a href="/api/admin/job-status" class="btn btn-secondary">🔄 Refresh Status</a>
        </div>
        
        <details style="margin-top: 30px;">
          <summary style="cursor: pointer; padding: 10px; background: #e9ecef; border-radius: 4px;">Raw Data (JSON)</summary>
          <pre>${JSON.stringify({
            activeJobs: activeJobs.length,
            completedJobs,
            failedJobs,
            maxConcurrent: process.env.MAX_CONCURRENT_JOBS || 3,
            activeJobDetails: activeJobs.map(job => ({
              id: job._id,
              status: job.status,
              phase: job.currentPhase,
              created: job.createdAt,
              lastUpdate: job.updatedAt,
              ageMinutes: Math.round((Date.now() - job.updatedAt.getTime()) / (1000 * 60))
            }))
          }, null, 2)}</pre>
        </details>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error checking job status:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1 style="color: #dc3545;">❌ Status Check Error</h1>
          <p>There was an error checking job status:</p>
          <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px;">${error.message}</pre>
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">← Back to Novel Generator</a>
        </body>
      </html>
    `);
  }
});

module.exports = router;
