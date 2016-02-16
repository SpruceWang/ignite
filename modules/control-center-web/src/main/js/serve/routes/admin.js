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

'use strict';

// Fire me up!

module.exports = {
    implements: 'admin-routes',
    inject: ['require(lodash)', 'require(express)', 'require(nodemailer)', 'settings', 'mongo']
};

module.exports.factory = function(_, express, nodemailer, settings, mongo) {
    return new Promise((factoryResolve) => {
        const router = new express.Router();

        /**
         * Get list of user accounts.
         */
        router.post('/list', (req, res) => {
            mongo.Account.find({}).sort('username').exec()
                .then((users) => res.json(users))
                .catch((err) => mongo.handleError(res, err));
        });

        // Remove user.
        router.post('/remove', (req, res) => {
            const userId = req.body.userId;
            let user = {};

            mongo.Account.findByIdAndRemove(userId).exec()
                .then((removedUser) => {
                    user = removedUser;

                    return mongo.spaces(userId);
                })
                .then((spaces) => {
                    const promises = [];

                    _.forEach(spaces, (space) => {
                        promises.push(mongo.Cluster.remove({space: space._id}).exec());
                        promises.push(mongo.Cache.remove({space: space._id}).exec());
                        promises.push(mongo.DomainModel.remove({space: space._id}).exec());
                        promises.push(mongo.Notebook.remove({space: space._id}).exec());
                        promises.push(mongo.Space.remove({owner: space._id}).exec());
                    });

                    return Promise.all(promises);
                })
                .then(() => {
                    return new Promise((resolveMail, rejectMail) => {
                        const transporter = {
                            service: settings.smtp.service,
                            auth: {
                                user: settings.smtp.email,
                                pass: settings.smtp.password
                            }
                        };

                        if (transporter.service !== '' || transporter.auth.user !== '' || transporter.auth.pass !== '') {
                            const mailer = nodemailer.createTransport(transporter);

                            const mailOptions = {
                                from: settings.smtp.address(settings.smtp.username, settings.smtp.email),
                                to: settings.smtp.address(user.username, user.email),
                                subject: 'Your account was deleted',
                                text: 'You are receiving this e-mail because admin remove your account.\n\n' +
                                '--------------\n' +
                                settings.smtp.username + ' http://' + req.headers.host + '\n'
                            };

                            mailer.sendMail(mailOptions, (errMailer) => {
                                if (errMailer) {
                                    rejectMail({
                                        code: 503,
                                        message: 'Account was removed, but failed to send e-mail notification to user!<br />' + errMailer
                                    });
                                }
                                else
                                    resolveMail();
                            });
                        }
                        else
                            rejectMail({code: 503, message: 'Account was removed, but failed to send e-mail notification to user, because mailer is not configured!'});
                    });
                })
                .then(() => res.sendStatus(200))
                .catch((err) => mongo.handleError(res, err));
        });

        // Save user.
        router.post('/save', (req, res) => {
            const params = req.body;

            mongo.Account.findByIdAndUpdate(params.userId, {admin: params.adminFlag}).exec()
                .then(() => res.sendStatus(200))
                .catch((err) => mongo.handleError(res, err));
        });

        // Become user.
        router.get('/become', (req, res) => {
            mongo.Account.findById(req.query.viewedUserId).exec()
                .then((viewedUser) => {
                    req.session.viewedUser = viewedUser;

                    res.sendStatus(200);
                })
                .catch(() => res.sendStatus(404));
        });

        // Revert to your identity.
        router.get('/revert/identity', (req, res) => {
            req.session.viewedUser = null;

            return res.sendStatus(200);
        });

        factoryResolve(router);
    });
};
