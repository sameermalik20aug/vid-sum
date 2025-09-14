import React, { useState } from 'react';
import { Youtube, Loader2, Sparkles, FileText, Copy, AlertCircle } from 'lucide-react';
import Button from './components/Button';
import Input from './components/Input';
import Card from './components/Card';
import Alert from './components/Alert';
import './styles/App.css';

const App = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:8000';

  const isValidYouTubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+(&\S*)?$/;
    return youtubeRegex.test(url);
  };

  const summarizeVideo = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(videoUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: videoUrl
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to summarize video');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred while processing the video');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    summarizeVideo();
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="header-content">
            <Youtube className="header-icon" />
            <h1 className="header-title">VidSum</h1>
          </div>
          <p className="header-description">
            Transform YouTube videos into concise, intelligent summaries using AI
          </p>
        </div>

        {/* Input Section */}
        <Card className="input-card">
          <div className="card-header">
            <h2 className="card-title">Enter YouTube URL</h2>
            <p className="card-description">
              Paste any YouTube video URL to get started
            </p>
          </div>
          <div className="card-content">
            <form onSubmit={handleSubmit} className="input-form">
              <Input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={loading}
                className="url-input"
              />
              <Button 
                type="submit" 
                disabled={loading || !videoUrl.trim()}
                variant="primary"
                className="submit-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="button-icon animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="button-icon" />
                    Summarize
                  </>
                )}
              </Button>
            </form>
          </div>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert variant="error" className="error-alert">
            <AlertCircle className="alert-icon" />
            <span>{error}</span>
          </Alert>
        )}

        {/* Results */}
        {result && (
          <div className="results">
            {/* Video Info */}
            <Card className="info-card">
              <div className="card-content">
                <div className="video-info">
                  <div className="info-item">
                    <span className="info-label">Video ID:</span>
                    <span className="info-value">{result.video_id}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Transcript Length:</span>
                    <span className="info-value">{result.transcript_length} characters</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Status:</span>
                    <span className="info-value success">✓ Processed</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary */}
            <Card className="summary-card">
              <div className="card-header">
                <h3 className="card-title">
                  <Sparkles className="title-icon" />
                  AI Summary
                </h3>
              </div>
              <div className="card-content">
                <div className="summary-content">
                  <p className="summary-text">{result.summary}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(result.summary, 'Summary')}
                  className="copy-button"
                >
                  <Copy className="button-icon" />
                  Copy Summary
                </Button>
              </div>
            </Card>

            {/* Transcript Preview */}
            <Card className="transcript-card">
              <div className="card-header">
                <h3 className="card-title">
                  <FileText className="title-icon" />
                  Transcript Preview
                </h3>
                <p className="card-description">
                  First 2000 characters of the video transcript
                </p>
              </div>
              <div className="card-content">
                <div className="transcript-container">
                  <pre className="transcript-text">{result.transcript}</pre>
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(result.transcript, 'Transcript')}
                  className="copy-button"
                >
                  <Copy className="button-icon" />
                  Copy Transcript
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;