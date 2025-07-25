import { createContext, useContext, useReducer } from 'react';

const NovelContext = createContext();

const initialState = {
  job: null,
  currentPhase: null,
  progress: {
    outlineComplete: false,
    chaptersCompleted: 0,
    totalChapters: 0
  },
  outline: [],
  chapters: [],
  error: null,
  isLoading: false,
  // New monitoring data
  monitoring: {
    storyBible: {
      characters: {},
      plotThreads: [],
      timeline: [],
      locations: {},
      themes: []
    },
    continuityAlerts: [],
    qualityMetrics: {
      humanLikenessScore: 0,
      complexityScore: 0,
      consistencyScore: 0,
      creativityScore: 0
    },
    costTracking: {
      totalCost: 0,
      tokensUsed: 0,
      estimatedRemaining: 0,
      breakdown: {
        analysis: 0,
        outline: 0,
        chapters: 0
      }
    },
    enhancementsApplied: [],
    aiDecisions: [],
    systemHealth: {
      status: 'idle',
      lastUpdate: null,
      performance: {}
    },
    generationProgress: {
      currentStep: '',
      percentage: 0,
      estimatedTimeRemaining: null,
      lastActivity: null
    }
  }
};

function novelReducer(state, action) {
  switch (action.type) {
    case 'START_GENERATION':
      return { 
        ...state, 
        isLoading: true, 
        error: null, 
        job: action.payload 
      };
    case 'UPDATE_PROGRESS':
      return { 
        ...state, 
        isLoading: false, 
        ...action.payload 
      };
    case 'GENERATION_COMPLETE':
      return { 
        ...state, 
        isLoading: false, 
        ...action.payload 
      };
    case 'GENERATION_CANCELLED':
      return { 
        ...state, 
        isLoading: false, 
        status: 'cancelled',
        currentPhase: 'cancelled',
        error: 'Generation was cancelled by user'
      };
    case 'GENERATION_ERROR':
      return { 
        ...state, 
        isLoading: false, 
        error: action.payload 
      };
    case 'RESET':
      return initialState;
    
    // New monitoring action types
    case 'STORY_BIBLE_UPDATE':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          storyBible: {
            ...state.monitoring.storyBible,
            ...action.payload
          }
        }
      };
    
    case 'CONTINUITY_ALERT':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          continuityAlerts: [
            ...state.monitoring.continuityAlerts,
            {
              ...action.payload,
              timestamp: Date.now(),
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          ]
        }
      };
    
    case 'GENERATION_PROGRESS_UPDATE':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          generationProgress: {
            ...state.monitoring.generationProgress,
            ...action.payload,
            lastActivity: Date.now()
          }
        }
      };
    
    case 'PHASE_TRANSITION':
      return {
        ...state,
        currentPhase: action.payload.phase,
        monitoring: {
          ...state.monitoring,
          systemHealth: {
            ...state.monitoring.systemHealth,
            lastUpdate: Date.now()
          }
        }
      };
    
    case 'QUALITY_METRICS_UPDATE':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          qualityMetrics: {
            ...state.monitoring.qualityMetrics,
            ...action.payload
          }
        }
      };
    
    case 'COST_TRACKING_UPDATE':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          costTracking: {
            ...state.monitoring.costTracking,
            ...action.payload
          }
        }
      };
    
    case 'ENHANCEMENT_APPLIED':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          enhancementsApplied: [
            ...state.monitoring.enhancementsApplied,
            {
              ...action.payload,
              timestamp: Date.now(),
              id: `enhancement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          ]
        }
      };
    
    case 'AI_DECISION_LOGGED':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          aiDecisions: [
            ...state.monitoring.aiDecisions.slice(-49), // Keep last 50 decisions
            {
              ...action.payload,
              timestamp: Date.now(),
              id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          ]
        }
      };
    
    case 'SYSTEM_HEALTH_UPDATE':
      return {
        ...state,
        monitoring: {
          ...state.monitoring,
          systemHealth: {
            ...state.monitoring.systemHealth,
            ...action.payload,
            lastUpdate: Date.now()
          }
        }
      };
    
    default:
      return state;
  }
}

export function NovelProvider({ children }) {
  const [state, dispatch] = useReducer(novelReducer, initialState);
  
  return (
    <NovelContext.Provider value={{ state, dispatch }}>
      {children}
    </NovelContext.Provider>
  );
}

export function useNovel() {
  return useContext(NovelContext);
}
