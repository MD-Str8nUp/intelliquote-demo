'use client'

import React, { useRef, useState, useCallback } from 'react'
import { useAppContext, UploadedFile } from './context'
import { Upload, X, FileText } from 'lucide-react'

export function DataUploadZone() {
  const { uploadedFiles, addUploadedFile, updateUploadedFile, removeUploadedFile } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files ? Array.from(e.target.files) : [])
  }, [])

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (!file.type.includes('pdf')) return

      const uploadFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        progress: 0,
      }

      addUploadedFile(uploadFile)

      // Simulate upload
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 20
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          updateUploadedFile(uploadFile.id, { progress: 100, status: 'processing' })
          setTimeout(() => {
            updateUploadedFile(uploadFile.id, {
              status: 'extracted',
              extractedData: { walls: 24, openings: 12, pageCount: 3, scale: '1:100' }
            })
          }, 2000)
        } else {
          updateUploadedFile(uploadFile.id, { progress })
        }
      }, 200)
    })
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 text-center ${isDragging ? 'border-amber-500 bg-amber-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
      >
        <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-lg font-medium text-slate-900 mb-1">{isDragging ? 'Drop files here' : 'Drag & drop PDF plans'}</p>
        <p className="text-sm text-slate-500 mb-4">or click to browse</p>
        <p className="text-xs text-slate-400">Vector PDFs work best. Max file size: 50MB</p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map(file => (
            <div key={file.id} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span className={`font-medium ${file.status === 'uploading' ? 'text-blue-600' : file.status === 'processing' ? 'text-amber-600' : file.status === 'extracted' ? 'text-green-600' : 'text-red-600'}`}>
                    {file.status === 'uploading' ? 'Uploading...' : file.status === 'processing' ? 'Extracting data...' : file.status === 'extracted' ? 'Ready' : 'Error'}
                  </span>
                </div>
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${file.status === 'uploading' ? 'bg-blue-500' : 'bg-amber-500 animate-pulse'}`} style={{ width: file.status === 'uploading' ? `${file.progress}%` : '100%' }} />
                  </div>
                )}
                {file.status === 'extracted' && file.extractedData && (
                  <p className="text-xs text-slate-500 mt-1">
                    {file.extractedData.pageCount} pages | {file.extractedData.walls} walls | {file.extractedData.openings} openings | Scale: {file.extractedData.scale}
                  </p>
                )}
              </div>
              <button onClick={() => removeUploadedFile(file.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DataUploadPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Upload Plans</h1>
        <p className="text-slate-500 mt-1">Upload your architectural or structural PDFs for automatic measurement extraction</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataUploadZone />

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Tips for best results</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Use vector PDFs (from AutoCAD, Revit, ArchiCAD) for 100% accurate measurements</li>
            <li>Ensure plans are to scale and include dimension annotations</li>
            <li>Include the General Notes page for wind class and soil type extraction</li>
            <li>Scanned/raster PDFs will require manual verification</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
