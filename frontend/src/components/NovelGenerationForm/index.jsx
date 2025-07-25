import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNovel } from '../../context/NovelContext';
import { generateNovel, uploadPremise, getGenres } from '../../services/api';
import GenreSelector from './GenreSelector';
import NovelConfigForm from './NovelConfigForm';
import PremiseUploader from './PremiseUploader';
import '../../styles/NovelGenerationForm.css';

function NovelGenerationForm() {
  const navigate = useNavigate();
  const { dispatch } = useNovel();
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    subgenre: '',
    premise: '',
    targetWordCount: 50000,
    targetChapters: 15,
    humanLikeWriting: true // Default to enabled for better user experience
  });
  const [genres, setGenres] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load available genres
    const loadGenres = async () => {
      try {
        const genresData = await getGenres();
        setGenres(genresData);
      } catch (err) {
        console.error('Error loading genres:', err);
        setError('Failed to load genre options. Please refresh the page.');
      }
    };
    
    loadGenres();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenreChange = (genre, subgenre) => {
    console.log('Genre change:', JSON.stringify({ genre, subgenre }, null, 2)); // Debug log
    setFormData(prev => ({ 
      ...prev, 
      genre: genre || '', 
      subgenre: subgenre || '' 
    }));
  };

  const handlePremiseChange = (premise) => {
    setFormData(prev => ({ ...prev, premise }));
  };

  const handlePremiseUpload = async (file) => {
    try {
      setIsLoading(true);
      const result = await uploadPremise(file);
      setFormData(prev => ({ ...prev, premise: result.premise }));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading premise');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Form data being submitted:', JSON.stringify(formData, null, 2));
      const result = await generateNovel(formData);
      dispatch({ type: 'START_GENERATION', payload: { jobId: result.jobId } });
      navigate(`/progress/${result.jobId}`);
    } catch (err) {
      console.error('Generation error details:', err.response?.data);
      setError(err.response?.data?.message || err.response?.data?.error || 'Error starting generation');
      setIsLoading(false);
    }
  };

  return (
    <div className="novel-generation-form">
      <h2>Generate a Novel</h2>
      <div style={{ marginBottom: '20px' }}>
        <a href="/api/admin/kill-all-jobs" target="_blank" style={{ color: '#dc3545', textDecoration: 'none', fontSize: '14px' }}>
          🔧 Admin: Kill All Jobs
        </a>
      </div>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Enter your novel title"
            required
          />
        </div>
        
        <GenreSelector 
          genres={genres}
          selectedGenre={formData.genre}
          selectedSubgenre={formData.subgenre}
          onChange={handleGenreChange}
        />
        
        <NovelConfigForm
          targetWordCount={formData.targetWordCount}
          targetChapters={formData.targetChapters}
          humanLikeWriting={formData.humanLikeWriting}
          onChange={handleInputChange}
        />
        
        <PremiseUploader
          premise={formData.premise}
          onChange={handlePremiseChange}
          onFileUpload={handlePremiseUpload}
        />
        
        <button 
          type="submit" 
          disabled={isLoading || !formData.title || !formData.genre || !formData.subgenre || !formData.premise}
          className="generate-button"
        >
          {isLoading ? 'Processing...' : 'Generate Novel'}
        </button>
      </form>
    </div>
  );
}

export default NovelGenerationForm;
