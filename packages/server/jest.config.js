module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.test.ts"],
	verbose: true,
	testTimeout: 10000,
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{ diagnostics: false },
		],
	},
};
