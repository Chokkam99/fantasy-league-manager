'use client'

import { useState } from 'react'

interface ShareButtonProps {
  shareUrl: string
  label?: string
  className?: string
}

export default function ShareButton({ shareUrl, label = "Share", className = "" }: ShareButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipMessage, setTooltipMessage] = useState('')

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setTooltipMessage('Link copied to clipboard!')
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setTooltipMessage('Failed to copy link')
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2000)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors text-white ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        {label}
      </button>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-50">
          {tooltipMessage}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  )
}