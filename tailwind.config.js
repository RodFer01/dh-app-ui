/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sap: {
          blue:     '#0070f2',
          'blue-d': '#0064d9',
          'blue-l': '#E1F4FF',
          bg:       '#f5f6f7',
          border:   '#e1e2e6',
          text:     '#32363A',
          muted:    '#556b82',
          subtle:   '#758ca4',
          success:  '#256f3a',
          warning:  '#E76500',
          error:    '#BB0000',
          neutral:  '#788fa6',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        hover: '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
