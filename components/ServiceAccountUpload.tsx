'use client';

import { useState } from 'react';

interface ServiceAccountUploadProps {
    onUploadSuccess: () => void;
}

export default function ServiceAccountUpload({ onUploadSuccess }: ServiceAccountUploadProps) {
    const [error, setError] = useState('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setError('');

        if (!file) return;

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            setError('Please upload a valid JSON file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const json = JSON.parse(text);

                // Basic validation to check if it looks like a service account
                if (!json.type || json.type !== 'service_account') {
                    // Warn but maybe allow? User knows best? 
                    // Let's be strict to avoid confusion later.
                    // console.warn('JSON does not look like a standard service account');
                }

                localStorage.setItem('service_account_json', JSON.stringify(json));
                onUploadSuccess();
            } catch (err) {
                setError('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                    Upload Service Account
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Please upload your Google Service Account JSON file to continue.
                </p>

                {error && (
                    <div className="p-3 text-sm text-red-500 bg-red-100 rounded dark:bg-red-900/30 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span></p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">JSON key file</p>
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept=".json"
                            onChange={handleFileUpload}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
