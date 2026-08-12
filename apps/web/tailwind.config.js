/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D4F4F',
          light: '#1A6B6B',
          dark: '#0A3D3D',
        },
        secondary: '#4A9B9B',
        accent: {
          DEFAULT: '#E8913A',
          dark: '#D47A2A',
          coral: '#E07A5F',
        },
        surface: '#FFFFFF',
        background: '#F5F7F7',
        integra: {
          success: '#2D8F6F',
          warning: '#E8913A',
          error: '#D64545',
          info: '#4A9B9B',
          gray: {
            50: '#F5F7F7',
            100: '#E8ECEB',
            200: '#D1D9D8',
            400: '#9AABA9',
            600: '#6B7B7B',
            900: '#1A2E2E',
          },
        },
        appointment: {
          created: '#D1D9D8',
          confirmed: '#1A6B6B',
          arrived: '#4A9B9B',
          in_progress: '#E8913A',
          completed: '#2D8F6F',
          cancelled: '#9AABA9',
          no_show: '#E07A5F',
          rescheduled: '#8B9BA9',
        },
      },
      boxShadow: {
        sm: '0 1px 2px rgba(13, 79, 79, 0.05)',
        md: '0 4px 12px rgba(13, 79, 79, 0.08)',
        lg: '0 8px 24px rgba(13, 79, 79, 0.12)',
      },
      borderRadius: {
        xl: '20px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
