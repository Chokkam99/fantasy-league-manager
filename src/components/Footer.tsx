export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-gray-600">
              Made with ❤️ by <span className="font-semibold text-orange-600">Rithvik Chokkam</span>
            </p>
            <p className="text-xs text-gray-500">
              © {currentYear} Fantasy League Manager™. All rights reserved.
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>🏆 Bringing fantasy leagues to life</span>
          </div>
        </div>
      </div>
    </footer>
  )
}