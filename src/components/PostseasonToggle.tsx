'use client'

import React from 'react'

interface PostseasonToggleProps {
  includePostseason: boolean
  onToggle: (include: boolean) => void
  disabled?: boolean
  className?: string
}

export default function PostseasonToggle({ 
  includePostseason, 
  onToggle, 
  disabled = false,
  className = ''
}: PostseasonToggleProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className={`text-sm font-medium ${includePostseason ? 'text-gray-500' : 'text-gray-900'}`}>
        Regular Season
      </span>
      
      <button
        onClick={() => onToggle(!includePostseason)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${includePostseason ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        role="switch"
        aria-checked={includePostseason}
        aria-label="Toggle postseason inclusion"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
            ${includePostseason ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      
      <span className={`text-sm font-medium ${includePostseason ? 'text-gray-900' : 'text-gray-500'}`}>
        Include Postseason
      </span>
    </div>
  )
}