import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const App = () => {
    const [documentFile, setDocumentFile] = useState(null);
    const [documentPreview, setDocumentPreview] = useState(null);
    const [classificationResult, setClassificationResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = error => reject(error);
    });

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload a valid image file of your document.');
                return;
            }
            setDocumentFile(file);
            setDocumentPreview(URL.createObjectURL(file));
            setClassificationResult(null);
            setError(null);
        }
    };
    
    const handleClassifyClick = useCallback(async () => {
        if (!documentFile) {
            setError('Please upload a document to classify.');
            return;
        }
        setLoading(true);
        setError(null);
        setClassificationResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Image = await fileToBase64(documentFile);

            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: documentFile.type,
                },
            };

            const textPart = {
                text: `Analyze this document and classify it into one of the following categories based on its content: Public, Confidential, Highly Sensitive, or Unsafe. Provide a brief justification for your classification.`,
            };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            category: {
                                type: Type.STRING,
                                description: 'The classification category. Must be one of: Public, Confidential, Highly Sensitive, Unsafe.'
                            },
                            reason: {
                                type: Type.STRING,
                                description: 'A brief justification for the classification choice.'
                            }
                        },
                        required: ['category', 'reason']
                    },
                },
            });

            const resultText = response.text.trim();
            const resultJson = JSON.parse(resultText);

            if (resultJson.category && resultJson.reason) {
                setClassificationResult(resultJson);
            } else {
                throw new Error("Invalid response format from the model.");
            }

        } catch (err) {
            console.error(err);
            setError(err.message || 'An error occurred during classification.');
        } finally {
            setLoading(false);
        }
    }, [documentFile]);

    return (
        <div className="container">
            <header className="header">
                <h1>AI Document Classifier</h1>
                <p>Upload a document image to analyze and classify its sensitivity.</p>
            </header>

            {error && <div className="error-message">{error}</div>}

            {!documentPreview && (
                 <label htmlFor="file-upload" className="upload-container" aria-label="Upload a document">
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} />
                    <span>Click here to upload a document page</span>
                </label>
            )}

            {documentPreview && (
                <div className="classifier-container">
                    <div className="document-preview">
                        <img src={documentPreview} alt="Document preview" />
                    </div>
                    
                    <button 
                        className="classify-button"
                        onClick={handleClassifyClick} 
                        disabled={loading}
                        aria-busy={loading}
                    >
                        {loading ? 'Classifying...' : 'Classify Document'}
                    </button>

                    <div className="results-container">
                        {loading && (
                            <div className="loader-container">
                                <div className="loader" aria-label="Loading classification result"></div>
                                <p>Analyzing document...</p>
                            </div>
                        )}
                        {!loading && !classificationResult && (
                             <div className="placeholder">The classification result will appear here.</div>
                        )}
                        {!loading && classificationResult && (
                            <div className="classification-result">
                                <div 
                                    className="classification-badge" 
                                    data-category={classificationResult.category}
                                >
                                    {classificationResult.category}
                                </div>
                                <p className="classification-reason">{classificationResult.reason}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);