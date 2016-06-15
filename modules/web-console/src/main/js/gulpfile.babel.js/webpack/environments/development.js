/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import {destDir, rootDir} from '../../paths';
import jade from 'jade';
import path from 'path';

export default () => {
    let plugins = [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            templateContent: function () {
                return jade.renderFile(path.join(rootDir, 'views', 'index.jade'));
            },
            title: 'DEBUG:Ignite Web Console'
        })
    ];

    return {
        context: rootDir,
        debug: true,
        devtool: 'cheap-module-eval-source-map',
        watch: true,
        devServer: {
            historyApiFallback: true,
            publicPath: '/',
            contentBase: destDir,
            info: true,
            hot: true,
            inline: true,
            proxy: {
                '/socket.io': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    ws: true
                },
                '/api/v1/*': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    rewrite: function(req) {
                        req.url = req.url.replace(/^\/api\/v1/, '');
                        return req;
                    }
                }
            },
            watchOptions: {
                aggregateTimeout: 1000,
                poll: 1000
            },
            stats: 'verbose',
            port: 9000
        },
        stats: {colors: true},
        plugins
    };
};
