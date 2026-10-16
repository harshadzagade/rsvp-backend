const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { getCredentialsForEvent } = require('../utils/config');
const { verifyPaymentWithPayU } = require('../utils/payu');
const { sendThankYouEmail, sendAdminNotificationEmail } = require('../utils/email');

const prisma = new PrismaClient();

let isRunning = false;

async function syncInitiatedPayments() {
  if (isRunning) {
    console.log('[Cron PayU Sync] Previous run still in progress, skipping...');
    return;
  }

  isRunning = true;
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find transactions initiated between 15 minutes ago and 48 hours ago
    const pendingRsvps = await prisma.rSVP.findMany({
      where: {
        status: 'initiated',
        createdAt: {
          lte: fifteenMinutesAgo,
          gte: twoDaysAgo,
        },
      },
      include: { event: true, payment: true },
      take: 50, // Batch limit per cycle
    });

    if (pendingRsvps.length === 0) {
      return;
    }

    console.log(`[Cron PayU Sync] Found ${pendingRsvps.length} pending 'initiated' transactions to verify with PayU.`);

    let updatedCount = 0;

    for (const rsvp of pendingRsvps) {
      try {
        const credentials = getCredentialsForEvent(rsvp.event);
        if (!credentials || !credentials.key || !credentials.salt) {
          continue;
        }

        const verification = await verifyPaymentWithPayU({
          key: credentials.key,
          salt: credentials.salt,
          txnid: rsvp.txnid,
          baseUrl: credentials.baseUrl,
        });

        const payuStatus = String(verification.verifiedStatus || '').toLowerCase();
        const raw = verification.raw;
        let newStatus = null;

        if (payuStatus === 'success') {
          newStatus = 'success';
        } else if (payuStatus === 'failure' || payuStatus === 'failed' || payuStatus === 'bounced') {
          newStatus = payuStatus;
        } else if (payuStatus === 'not found' || payuStatus === 'usercancelled' || payuStatus === 'dropped') {
          newStatus = 'cancelled';
        } else if (payuStatus === 'in progress' || payuStatus === 'pending' || payuStatus === 'initiated' || !payuStatus) {
          // If transaction has been pending for more than 2 hours, PayU session is dead/dropped
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          if (new Date(rsvp.createdAt) < twoHoursAgo) {
            newStatus = 'dropped';
          }
        }

        if (newStatus && newStatus !== rsvp.status) {
          await prisma.rSVP.update({
            where: { txnid: rsvp.txnid },
            data: { status: newStatus },
          });

          const amountVal = verification.txnDetails?.amount 
            ? parseInt(verification.txnDetails.amount) 
            : (rsvp.payment?.amount || rsvp.formData?.amount || rsvp.event.fee);

          await prisma.payment.upsert({
            where: { txnid: rsvp.txnid },
            update: {
              status: newStatus,
              amount: amountVal,
              payuResponse: raw || {},
            },
            create: {
              txnid: rsvp.txnid,
              amount: amountVal,
              status: newStatus,
              payuResponse: raw || {},
            },
          });

          updatedCount++;
          console.log(`[Cron PayU Sync] Updated txnid ${rsvp.txnid} from '${rsvp.status}' to '${newStatus}' (PayU status: '${payuStatus}')`);

          // If marked success on PayU late, send confirmation email
          if (newStatus === 'success') {
            try {
              await sendThankYouEmail({
                to: rsvp.email,
                name: rsvp.fullName,
                eventTitle: rsvp.event.title,
                eventDate: rsvp.event.date,
                venue: rsvp.event.venue,
                amount: amountVal,
                txnid: rsvp.txnid,
                formData: rsvp.formData || {},
                credentials,
              });
            } catch (mailErr) {
              console.error(`[Cron PayU Sync] Failed to send email for ${rsvp.txnid}:`, mailErr.message);
            }
          }
        }
      } catch (txnErr) {
        console.error(`[Cron PayU Sync] Error verifying txnid ${rsvp.txnid}:`, txnErr.message);
      }
    }

    if (updatedCount > 0) {
      console.log(`[Cron PayU Sync] Batch complete. ${updatedCount} transactions updated.`);
    }
  } catch (err) {
    console.error('[Cron PayU Sync] General error in cron job:', err.message);
  } finally {
    isRunning = false;
  }
}

function initCronJobs() {
  // Schedule every 15 minutes: '*/15 * * * *'
  cron.schedule('*/15 * * * *', () => {
    syncInitiatedPayments();
  });

  console.log('[Cron Service] PayU auto-sync cron scheduled (every 15 minutes).');
}

module.exports = {
  initCronJobs,
  syncInitiatedPayments,
};
