import clioutput from '../devel/utils/clioutput';
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const precss = require('precss');
const autoprefixer = require('autoprefixer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const helper = require('../devel/utils/helpers');
const argv = helper.parseArguments(process.argv.slice(2));
const isDevel = process.env.NODE_ENV !== 'production' && !argv['env.production'];
const isProduction = !isDevel;
const isHot = argv['hot'] || false;
const src = path.resolve(process.cwd(), 'src');
const dist = path.resolve(process.cwd(), 'dist');
const jsDir = path.resolve(dist, 'js');
const cssDir = path.resolve(dist, 'css');
const vendorDir = path.resolve(dist, 'vendors');
const publicPath = '/';

const devPlugins = () => {

  if(isDevel) {
    clioutput.hr();
    const vendorManifest = path.resolve(vendorDir, 'vendors-manifest.json');
    const indexHTML = path.resolve(src, 'index.html');

    // Check that vendor manifest exists
    if (!fs.existsSync(vendorManifest)) {
      clioutput.error('Vendor manifest json is missing.');
      clioutput.error('Please run `npm run vendor:perf`');
      process.exit(0);
    }

    // Check that main index.html exits
    if (!fs.existsSync(indexHTML)) {
      clioutput.error('src/index.html is missing.');
      process.exit(0);
    }

    const templateContent = () => {
      clioutput.info('Injecting vendors-perf.js...');
      const jsdom = require('jsdom');
      const document = jsdom.jsdom(fs.readFileSync(indexHTML, 'utf8').toString());
      document.head.insertAdjacentHTML('beforeend', `<script type="text/javascript" src="${publicPath}vendors/vendors-perf.js"></script>`);
      return jsdom.serializeDocument(document);
    };

    return [
      new webpack.DllReferencePlugin({
        context: process.cwd(),
        manifest: require(vendorManifest)
      }),

      new HtmlWebpackPlugin({
        templateContent: templateContent(),
        inject: 'head',
        chunksSortMode: 'none',
        xhtml: true,
      }),
    ];
  }
  return [];
};

const hotPlugins = isHot ? [
  new webpack.HotModuleReplacementPlugin({
    multiStep: true,
  }),
] : [];

const prodPlugins = isProduction ? [
  new webpack.optimize.CommonsChunkPlugin({
    names: ['vendors', 'manifest'],
  }),

  new HtmlWebpackPlugin({
    template: './index.html',
    inject: 'head',
    chunksSortMode: 'dependency',
    xhtml: true,
    minify: {
      removeComments: true,
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    },
  }),

  new webpack.LoaderOptionsPlugin({
    minimize: true,
    debug: false,
    quiet: true
  }),

  new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      screw_ie8: true,
      conditionals: true,
      unused: true,
      comparisons: true,
      sequences: true,
      dead_code: true,
      evaluate: true,
      if_return: true,
      join_vars: true,
    },
    output: {
      comments: false
    },
    sourceMap: true
  }),
] : [];


const cssRules = isHot ? [
  {
    test: /\.css$/,
    include: [
      src,
      path.resolve(process.cwd(), 'node_modules')
    ],
    use: [
      'raw-loader',
      'style-loader',
      'css-loader',
      'postcss-loader',
      'resolve-url-loader',
    ]
  },
  {
    test: /\.s?(a|c)ss$/,
    include: [
      src,
      path.resolve(process.cwd(), 'node_modules')
    ],
    use: [
      'style-loader',
      'css-loader',
      'postcss-loader',
      'resolve-url-loader',
      { loader: 'sass-loader', query: { sourceMap: isProduction ? 'compressed' : 'expanded' } },
    ]
  },
] : [
  {
    test: /\.css$/,
    include: [
      src,
      path.resolve(process.cwd(), 'node_modules')
    ],
    loader: ExtractTextPlugin.extract({
      fallbackLoader: 'style-loader',
      loader: ['css-loader?sourceMap', 'postcss-loader', 'resolve-url-loader']
    })
  },
  {
    test: /\.s?(a|c)ss$/,
    include: [
      src,
      path.resolve(process.cwd(), 'node_modules')
    ],
    loader: ExtractTextPlugin.extract({
      fallbackLoader: 'style-loader',
      loader: [
        {
          loader: 'css-loader', query: { sourceMap: true }
        },
        'postcss-loader',
        'resolve-url-loader',
        {
          loader: 'sass-loader', query: { sourceMap: isProduction ? 'compressed' : 'expanded' }
        }
      ]
    })
  }
];

module.exports = {
  context: src,
  devtool: isProduction ? 'source-map' : 'cheap-module-eval-source-map',
  cache:   !isProduction,
  bail:    isProduction,
  target:  'web',
  resolve: {
    modules: [
      'src',
      'node_modules',
    ],
    extensions: ['.js', '.jsx', '.json', '.css', '.scss', '.html']
  },
  entry: helper.sanitizeObject({
    vendor: isProduction ? ['babel-polyfill', './js/vendors.js'] : [],
    'aframe-project': (isHot ? [
      '../devel/utils/webpack-runtime.js',
      'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000&reload=true',
    ] : [] ).concat([
      './js/index.js',
      './sass/entry.scss',
    ]),
  }),

  output: {
    filename: path.join('js', (isProduction ? '[name].[chunkhash].js' : '[name].js')),
    chunkFilename: isProduction ? '[name].[chunkhash].chunk.js' : '[name].chunk.js',
    path: dist,
    publicPath: publicPath,
    pathinfo: !isProduction,
  },
  performance: {
    hints: isProduction ? 'warning' : false,
  },
  module: {
    rules: [
      {
        test: /\.js[x]?$/,
        enforce: 'pre',
        loader: 'eslint-loader',
        options: {
          configFile: './config/eslint.json',
        },
        include: [src],
        exclude: [/node_modules/],
      },
      {
        test: /\.js[x]?$/,
        include: [src],
        exclude: [/node_modules/],
        loader: 'babel-loader',

      },
      {
        test: /\.html$/,
        loader: 'html-loader',
      },
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
      {
        test: /\.(jpg|jpeg)$/,
        loader: 'url-loader?name=[name].[ext]&limit=8192&mimetype=image/jpg'
      },
      {
        test: /\.gif$/,
        loader: 'url-loader?name=[name].[ext]&limit=8192&mimetype=image/gif'
      },
      {
        test: /\.png$/,
        use: 'url-loader?name=[name].[ext]&limit=8192&mimetype=image/png'
      },
      {
        test: /\.svg$/,
        loader: 'url-loader?name=[name].[ext]&limit=8192&mimetype=image/svg+xml'
      },
      {
        test: /\.woff?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: ['url-loader?name=[name].[ext]&limit=100000&mimetype=application/font-woff']
      },
      {
        test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: ['url-loader?name=[name].[ext]&limit=100000&mimetype=application/font-woff2']
      },
      {
        test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: ['file-loader?name=[name].[ext]&limit=100000&mimetype=application/octet-stream']
      },
      {
        test: /\.otf(\?.*)?$/,
        loader: 'file-loader?name=[name].[ext]&limit=10000&mimetype=font/opentype'
      },
    ].concat(cssRules)
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': isProduction ? JSON.stringify('production') : JSON.stringify('development'),
      __DEV__: !isProduction
    }),

    new webpack.ProvidePlugin({
      'fetch': 'imports-loader?this=>global!exports-loader?global.fetch!whatwg-fetch',
    }),

    new webpack.LoaderOptionsPlugin({
      minimize: isProduction,
      debug: !isProduction,
      stats: {
        colors: true
      },
      options: {
        context: src,
        output: {
          path: dist,
        },
        postcss: [
          precss,
          autoprefixer({
            browsers: [
              'last 2 versions',
              'ie >= 11',
            ],
          }),
        ],
      },
      eslint: {
        failOnWarning: false,
        failOnError: true
      },
    }),

    new webpack.NoErrorsPlugin(),

    new ExtractTextPlugin({
      filename: path.join('css', (isProduction ? '[name].[chunkhash].css' : '[name].css')),
      disable: false,
      allChunks: true
    }),

    new StyleLintPlugin({
      configFile: './config/stylelint.json',
      context: 'src/sass',
      files: '**/*.scss',
      syntax: 'scss',
      failOnError: false
    }),

    new CopyWebpackPlugin([
      { from: 'assets', to: 'assets' }
    ]),

    new webpack.NamedModulesPlugin(),

  ].concat(devPlugins()).concat(hotPlugins).concat(prodPlugins)
};