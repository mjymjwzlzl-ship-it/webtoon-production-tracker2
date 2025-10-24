/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./*.{js,ts,jsx,tsx}',
		'./components/**/*.{js,ts,jsx,tsx}',
		'./App.tsx'
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Nanum Gothic', 'sans-serif'],
			},
			colors: {
				'primary-blue': '#00529b',
			},
		},
	},
	plugins: [],
};
