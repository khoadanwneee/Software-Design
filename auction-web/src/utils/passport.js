import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as GitHubStrategy } from 'passport-github2';
import * as userModel from '../models/user.model.js';

// Serialize user vào session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user từ session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ===================== GENERIC OAUTH CALLBACK =====================
/**
 * DRY: Tạo callback handler chung cho tất cả OAuth providers.
 * @param {string} providerName - Tên provider (google, facebook, github, twitter)
 * @param {function} getEmail - Hàm lấy email từ profile: (profile) => string|null
 * @param {function} getDisplayName - Hàm lấy tên hiển thị: (profile) => string
 */
function createOAuthCallback(providerName, getEmail, getDisplayName) {
  return async (accessToken, refreshToken, profile, done) => {
    try {
      // Kiểm tra xem user đã tồn tại chưa
      let user = await userModel.findByOAuthProvider(providerName, profile.id);
      if (user) return done(null, user);

      // Kiểm tra email đã tồn tại chưa
      const email = getEmail(profile);
      if (email) {
        user = await userModel.findByEmail(email);
        if (user) {
          await userModel.addOAuthProvider(user.id, providerName, profile.id);
          return done(null, user);
        }
      }

      // Tạo user mới
      const newUser = await userModel.add({
        email: email || `${providerName}_${profile.id}@oauth.local`,
        fullname: getDisplayName(profile),
        password_hash: null,
        address: '',
        role: 'bidder',
        email_verified: true,
        oauth_provider: providerName,
        oauth_id: profile.id,
      });
      done(null, newUser);
    } catch (error) {
      done(error, null);
    }
  };
}

// Helper: lấy email chuẩn từ profile
const getStandardEmail = (profile) =>
  profile.emails && profile.emails[0] ? profile.emails[0].value : null;

// ===================== GOOGLE STRATEGY =====================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3005/account/auth/google/callback'
},
createOAuthCallback('google', getStandardEmail, (p) => p.displayName || 'Google User')
));

// ===================== FACEBOOK STRATEGY =====================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3005/account/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'name', 'emails'],
  enableProof: true
},
createOAuthCallback('facebook', getStandardEmail, (p) => p.displayName || 'Facebook User')
));

// ===================== TWITTER STRATEGY =====================
// DISABLED: Twitter API requires paid subscription ($100/month) for OAuth
// Free tier does not support OAuth since February 2023
/*
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3005/account/auth/twitter/callback',
  includeEmail: true
},
createOAuthCallback('twitter', getStandardEmail, (p) => p.displayName || p.username || 'Twitter User')
));
*/

// ===================== GITHUB STRATEGY =====================
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3005/account/auth/github/callback'
},
createOAuthCallback('github', getStandardEmail, (p) => p.displayName || p.username || 'GitHub User')
));

export default passport;