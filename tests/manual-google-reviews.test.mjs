import test from 'node:test';
import assert from 'node:assert/strict';
import {renderManualGoogleReviews} from '../server/public-workshop.mjs';
test('manual review label and link, no Google request',()=>{
 const data={public_google_url:'https://www.google.com/maps',google_rating:4.9,google_review_count:32,google_reviews_updated_at:'2026-11-25T10:00:00Z'};
 const html=renderManualGoogleReviews(data);
 assert.match(html,/4,9\/5/);assert.match(html,/32 avis Google/);assert.match(html,/non vérifiée par Naïtéa/);assert.match(html,/25\/11\/2026/);assert.match(html,/https:\/\/www.google.com\/maps/);
});
test('absent or invalid rating displays link only',()=>{
 assert.equal(renderManualGoogleReviews({google_rating:5,google_review_count:20}),'');
 assert.doesNotMatch(renderManualGoogleReviews({public_google_url:'https://www.google.com/maps',google_rating:6,google_review_count:20}),/avis Google<\/strong>/);
 assert.doesNotMatch(renderManualGoogleReviews({public_google_url:'https://www.google.com/maps'}),/naitea-review-score/);
});
