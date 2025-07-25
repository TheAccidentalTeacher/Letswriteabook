import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNovel } from '../../context/NovelContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getJobStatus } from '../../services/api';
import ProgressPhase from './ProgressPhase';
import ChapterProgress from './ChapterProgress';
import CostTracker from './CostTracker';
import '../../styles/GenerationProgress.css';

function GenerationProgress() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useNovel();
  const [isLoading, setIsLoading] = useState(true);
  const { isConnected } = useWebSocket(jobId);
  
  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const jobData = await getJobStatus(jobId);
        dispatch({ type: 'UPDATE_PROGRESS', payload: jobData });
        
        if (jobData.status === 'completed') {
          dispatch({ type: 'GENERATION_COMPLETE', payload: jobData });
        }
      } catch (error) {
        dispatch({ type: 'GENERATION_ERROR', payload: error.message || 'Failed to load job status' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJobStatus();
    
    // Set up polling as a fallback if WebSocket is not connected
    let pollingInterval;
    
    if (!isConnected) {
      pollingInterval = setInterval(fetchJobStatus, 10000); // Poll every 10 seconds
    }
    
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [jobId, dispatch, isConnected]);
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading progress...</p>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="error-container">
        <h2>Generation Error</h2>
        <p className="error-message">{state.error}</p>
        <button onClick={() => navigate('/')}>Start Over</button>
      </div>
    );
  }
  
  if (state.status === 'completed') {
    return (
      <div className="generation-progress">
        <div className="completion-container">
          <h2>Novel Generation Complete!</h2>
          <p>Your novel has been successfully generated.</p>
          <div className="completion-actions">
            <button onClick={() => navigate(`/preview/${jobId}`)}>📖 Read Your Novel</button>
            <button 
              className="secondary-button"
              onClick={() => navigate(`/monitor/${jobId}`)}
            >
              📊 View Full Analytics
            </button>
          </div>
        </div>
        
        {/* Show final metrics */}
        <div className="progress-layout">
          <div className="progress-main">
            <div className="completion-summary">
              <h3>Generation Summary</h3>
              <p>✅ Planning: Complete</p>
              <p>✅ Outlining: Complete</p>
              <p>✅ Writing: {state.progress?.chaptersCompleted || 0} chapters completed</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="generation-progress">
      <div className="progress-header">
        <h2>Generating Your Novel</h2>
        {!isConnected && (
          <div className="connection-warning">
            <p>⚠️ Connection lost - reconnecting...</p>
          </div>
        )}
      </div>
      
      <div className="progress-layout">
        {/* Left side - Main progress */}
        <div className="progress-main">
          <div className="progress-phases">
            <ProgressPhase 
              phase="planning"
              currentPhase={state.currentPhase}
              status={state.status}
              description="Analyzing premise and planning structure"
            />
            
            <ProgressPhase 
              phase="outlining"
              currentPhase={state.currentPhase}
              status={state.status}
              description="Creating chapter-by-chapter outline"
            />
            
            <ProgressPhase 
              phase="writing"
              currentPhase={state.currentPhase}
              status={state.status}
              description="Writing chapters based on outline"
            />
          </div>

          {state.currentPhase === 'chapter_writing' && (
            <ChapterProgress 
              completed={state.progress?.chaptersCompleted || 0}
              total={state.progress?.totalChapters || 0}
              estimatedCompletion={state.progress?.estimatedCompletion}
            />
          )}

          {import.meta.env.VITE_ENABLE_COST_TRACKING === 'true' && (
            <CostTracker 
              outlineGeneration={state.modelUsage?.outlineGeneration}
              chapterGeneration={state.modelUsage?.chapterGeneration}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default GenerationProgress;
