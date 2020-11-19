const path = require('path');

module.exports = {
    entry: './src/index.ts',
    target: "node",
    module: {
        rules: [
            {
                use: 'babel-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'ddns.js',
        path: path.resolve(__dirname, 'build')
    }
}
