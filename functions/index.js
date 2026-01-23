const functions = require("firebase-functions");
const admin = require("firebase-admin");

require('dotenv').config(); // Load .env file

// Use process.env directly
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) {
  console.warn("STRIPE_SECRET_KEY missing from environment.");
}

// --- ENVIRONMENT VARIABLE HELPER ---
// 1. Try to read from Cloud Config (Production)
// 2. If missing, try process.env (Local .env file)
// const getEnv = (key, subKey) => {
//   return (functions.config()[key] && functions.config()[key][subKey]) || process.env[key.toUpperCase() + "_" + subKey.toUpperCase()];
// };

// let stripeSecret = getEnv("stripe", "secret");

// Initialize Stripe (Remember to use Environment Variables for production keys later!)
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); 

const stripe = require("stripe")(stripeSecret);

admin.initializeApp();
const db = admin.firestore();

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  // --- 1. ROBUST AUTHENTICATION ---
  // Production: Use 'context.auth' (Secure)
  // Local Emulator Bypass: Use 'data.userId' if context fails (Node 24 fix)
  
  // Handle potential double-wrapping of data in some emulator versions
  const payload = data.data || data; 

  const userId = context.auth ? context.auth.uid : payload.userId;
  const userEmail = context.auth ? context.auth.token.email : payload.userEmail;

  if (!userId) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'User must be logged in to subscribe.'
    );
  }

  const priceId = payload.priceId;
  console.log(`[Info] Creating session for User: ${userId}`);

  // --- GET OR CREATE STRIPE CUSTOMER ---
  const userDocRef = db.collection('users').doc(userId);
  const userDocSnapshot = await userDocRef.get();

  let customerId;

  // Retrieve existing ID
  if (userDocSnapshot.exists) {
    customerId = userDocSnapshot.data().stripeCustomerId;
  }

  // If no customer ID found (New user OR Legacy user), create one
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail || "missing_email@example.com",
      metadata: { firebaseUID: userId }
    });
    customerId = customer.id;

    // Save/Merge into Firestore
    await userDocRef.set({ 
      stripeCustomerId: customerId,
      email: userEmail 
    }, { merge: true });
  }

  // --- 2. NEW GATEKEEPER: CHECK FOR ACTIVE SUBSCRIPTION ---
  // Before taking their money, check if they are already paying us.
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1 // We only need to know if ONE exists
    });

    if (subscriptions.data.length > 0) {
      console.log(`[Info] User ${userId} already has a subscription. Redirecting to Portal.`);
      
      // Create a Billing Portal Session instead of a Checkout Session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `https://sign-fast.vercel.app/dashboard`, 
      });

      return { url: portalSession.url };
    }
  } catch (err) {
    console.error("Error checking existing subscriptions:", err);
    // Proceeding even if this check fails is risky, but you could choose to throw here.
  }

  // --- 3. CREATE STRIPE CHECKOUT SESSION (Only if no active sub found) ---
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Redirect URLs
      success_url: `https://sign-fast.vercel.app/payment/success`, 
      cancel_url: `https://sign-fast.vercel.app/pricing?payment=cancelled`,
    });
    
    return { url: session.url };

  } catch (stripeError) {
    console.error("[Stripe Error]", stripeError);
    throw new functions.https.HttpsError('internal', stripeError.message);
  }
});

// --- WEBHOOK (Listens for successful payments) ---
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const endpointSecret = stripeWebhookSecret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // --- IDEMPOTENCY CHECK START ---
  const eventId = event.id;
  const eventRef = db.collection('processed_webhooks').doc(eventId);
  
  try {
    // Check if we have already processed this event
    const docSnap = await eventRef.get();
    if (docSnap.exists) {
      console.log(`Duplicate event ${eventId} detected. Skipping.`);
      return res.json({ received: true }); // Acknowledge receipt without re-processing
    }
  } catch (e) {
    console.error("Error checking idempotency:", e);
    // If DB check fails, we probably shouldn't proceed, or we risk duplicates. 
    // Letting it fail to 500 allows Stripe to retry later when DB is back.
    return res.status(500).send("Database Error");
  }
  // --- IDEMPOTENCY CHECK END ---


  const dataObject = event.data.object;
  const customerId = dataObject.customer;

  // Helper function to find user
  const getUserByCustomer = async (cid) => {
    const snapshot = await db.collection('users').where('stripeCustomerId', '==', cid).get();
    return snapshot.empty ? null : snapshot.docs[0];
  };

  try {
    let processed = false; // Flag to track if we actually did anything

    // NEW SUBSCRIPTION (Checkout Success)
    if (event.type === 'checkout.session.completed') {
       const userDoc = await getUserByCustomer(customerId);
       
       if (userDoc) {
        const userData = userDoc.data();
        const newSubscriptionId = dataObject.subscription;

        // --- DUPLICATE WATCHDOG START ---
          // Check if user is ALREADY active and this is a DIFFERENT subscription
          if (userData.subscriptionStatus === 'active' && 
            userData.subscriptionId && 
            userData.subscriptionId !== newSubscriptionId) {
            
            console.warn(`[Duplicate Detected] User ${userDoc.id} paid for sub ${newSubscriptionId} but already has ${userData.subscriptionId}`);

            // 1. Cancel the NEW (duplicate) subscription immediately
            // 'prorate: false' ensures they get a full refund if you set that up, 
            // but typically you want to explicitly refund the invoice too.
            await stripe.subscriptions.cancel(newSubscriptionId, {
              invoice_now: true,
            });

            // 2. Refund the payment (Optional but recommended)
            // We find the latest invoice for this new sub and refund it
            const latestInvoiceId = dataObject.invoice;
            if (latestInvoiceId) {
              const invoice = await stripe.invoices.retrieve(latestInvoiceId);
              if (invoice.payment_intent) {
                  await stripe.refunds.create({
                  payment_intent: invoice.payment_intent,
                  reason: 'duplicate'
                });
                console.log(`[Refunded] Payment for duplicate subscription ${newSubscriptionId}`);
              }
            }

            // 3. STOP here. Do not overwrite the existing valid subscription in DB.
            return res.json({ received: true, status: "duplicate_cancelled" });
          }
          // --- DUPLICATE WATCHDOG END ---

         await userDoc.ref.update({
           subscriptionStatus: 'active',
           subscriptionId: dataObject.subscription,
           plan: 'pro',
           updatedAt: new Date()
         });
         processed = true;
       }
    }

    // STATUS CHANGE (Payment Failed, Recovery, or Cancellation)
    // 2. & 3. COMBINED: HANDLE UPDATES AND CANCELLATIONS
    // This handles 'customer.subscription.updated' AND 'customer.subscription.deleted'
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const userDoc = await getUserByCustomer(customerId);

      if (userDoc) {
        // --- THE SAFETY CHECK ---
        // Regardless of what just happened (cancellation, expiration, payment failure),
        // we ask Stripe: "Does this customer currently have ANY active subscriptions?"
        const activeSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1 // We only need to find one to verify they are still Pro
        });

        if (activeSubscriptions.data.length > 0) {
          // CASE A: THEY ARE STILL PRO
          // Either the update was just a renewal, OR they cancelled one sub but have another valid one.
          const survivingSubscription = activeSubscriptions.data[0];
          
          console.log(`User ${userDoc.id} retains Pro access via sub: ${survivingSubscription.id}`);
          
          await userDoc.ref.update({
            subscriptionStatus: 'active',
            subscriptionId: survivingSubscription.id, // Ensure we point to the valid one
            plan: 'pro',
            updatedAt: new Date()
          });
          processed = true;

        } else {
          // CASE B: NO ACTIVE SUBSCRIPTIONS LEFT
          // They cancelled their last/only subscription, or it expired.
          console.log(`User ${userDoc.id} has 0 active subscriptions. Downgrading to Free.`);
          
          await userDoc.ref.update({ 
            subscriptionStatus: 'canceled', 
            plan: 'free',
            subscriptionId: admin.firestore.FieldValue.delete(), // clear the ID
            updatedAt: new Date()
          });
          processed = true;
        }
      }
    }

    // --- SAVE IDEMPOTENCY KEY ---
    // Only mark as processed if logic succeeded. 
    // This prevents locking the event if your code crashed halfway through.
    await eventRef.set({
      receivedAt: new Date(),
      type: event.type,
      processed: processed
    });

  } catch (err) {
    console.error(`Error processing webhook: ${err}`);
    // Return 500 so Stripe knows to retry this later (since we haven't saved the ID yet)
    return res.status(500).send("Internal Server Error");
  }

  res.json({ received: true });
});

// ---  CUSTOMER PORTAL (Manage/Cancel Subscription) ---
exports.createPortalSession = functions.https.onCall(async (data, context) => {
  // 1. Authenticate (Same robust logic as before)
  const payload = data.data || data;
  const userId = context.auth ? context.auth.uid : payload.userId;

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  console.log(`[Info] Creating portal session for User: ${userId}`);

  // Get Stripe Customer ID from Firestore
  const userDoc = await db.collection('users').doc(userId).get();
  const customerId = userDoc.data().stripeCustomerId;

  if (!customerId) {
    throw new functions.https.HttpsError('failed-precondition', 'No subscription found for this user.');
  }

  // Create Portal Session
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `https://sign-fast.vercel.app/profile`, // Where to send them back
    });

    return { url: session.url };
  } catch (error) {
    console.error(error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});