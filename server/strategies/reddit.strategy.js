const RedditStrategy = require('passport-reddit').Strategy;
const pool = require('../modules/pool');

let redditStrategyCallback = async (accessToken, refreshToken, profile, cb) => {
  console.log('\n');
  console.log('Reddit User Data:');
  console.log(profile);
  console.log('\n');
  cb(null, null);

  try {
    // PASSWORD IN THIS INSTANCE, IS THE ID PROVIDED BY REDDIT
    const qs_redditId = `SELECT * FROM "login" WHERE password=$1;`;
    const redditIdResult = await pool.query(qs_redditId, [profile.id]);

    if (redditIdResult.rows.length > 0) {
      //   // IF THAT REDDIT ID IS ALREADY SAVED IN LOGIN TABLE
      const userQuery = `SELECT * FROM "user" WHERE "id"=$1;`;
      const userResult = await pool.query(userQuery, [
        redditIdResult.rows[0]['user_id'],
      ]);
      const user = userResult.rows[0];
      cb(null, user);
    } else {
      // IF NOT, LETS SAVE IT AND A NEW USER
      // BUT WE ALSO NEED TO SEE IF THE EMAIL IS IN THE USER TABLE
      const qs_emailCheck = `SELECT * FROM "user" WHERE email=$1;`;
      const resultOfEmailCheck = await pool.query(qs_emailCheck, [
        profile.emails[0].value,
      ]);
      // IF THE USER USED ANOTHER SERVICE TO CREATE AN ACCOUNT
      // TELL THEM THEY SHOULD LOG IN WITH THAT SERVICE
      if (resultOfEmailCheck.rows.length > 0)
        cb('Email already in database. Sign in using your provider', null);

      const qs_createNewUser = `INSERT INTO "user" ("display_name", "first_name", "last_name", "email", "picture") VALUES ($1,$2,$3,$4,$5) RETURNING *;`;

      const userObject = {
        display_name: profile.name ? profile.name : null,
        first_name: null, // REDDIT DOES NOT HAVE FIRST NAME WITH OAUTH
        last_name: null, // REDDIT DOES NOT HAVE LAST NAME WITH OAUTH
        email: null, // REDDIT DOES NOT DISCLOSE EMAIL WITH OAUTH
        picture: null, // REDDIT DOES NOT DISCLOSE PICTURE WITH OAUTH
      };

      const resultOfNewUserSave = await pool.query(qs_createNewUser, [
        userObject.display_name,
        userObject.first_name,
        userObject.last_name,
        userObject.email,
        userObject.picture,
      ]);

      const qs_createNewLogin = `INSERT INTO "login" ("provider", "password", "user_id") VALUES ($1,$2,$3);`;
      const resultOfLoginSave = await pool.query(qs_createNewLogin, [
        profile.provider,
        profile.id,
        resultOfNewUserSave.rows[0].id,
      ]);

      cb(null, resultOfNewUserSave.rows[0]);
    }
  } catch (err) {
    cb(`Error with GitHub User: ${err}`, null);
  }
};

module.exports = (passport, callbackURL) => {
  passport.use(
    new RedditStrategy(
      {
        clientID: process.env.REDDIT_CONSUMER_ID,
        clientSecret: process.env.REDDIT_CONSUMER_SECRET,
        callbackURL,
      },
      redditStrategyCallback
    )
  );
};
