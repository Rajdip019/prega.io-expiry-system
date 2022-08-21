/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable indent */
/* eslint-disable require-jsdoc */
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Request, Response} from "firebase-functions";
const {CloudTasksClient} = require("@google-cloud/tasks");

admin.initializeApp();

async function makeExpirySharedCopy(req: Request, res: Response) {
  const {uid, ttl} = req.body;
  const userDocuments = [];
  const getUser = await admin.firestore().collection("user").doc(uid).get();
  const getDocuments = await admin
    .firestore()
    .collection(`user/${uid}/documents`)
    .orderBy("date")
    .get();
  getDocuments.forEach(async (doc) => {
    if (doc.data().visibility === true) {
      userDocuments.push(doc.data());
    }
  });
  const dataRef = await admin
    .firestore()
    .collection("shared-doc")
    .add({...getUser.data(), "documents": userDocuments});
  const id = dataRef.id;

  // Scheduling the cloud function - Cloud tasks
  const project = "test-project-019";
  const queue = "expire-link";
  const location = "us-central1";
  const url =
    "https://us-central1-test-project-019.cloudfunctions.net/expireLink";
  const payload = {id};
  const inSeconds = ttl;

  const tasksClient = new CloudTasksClient();
  const queuePath: string = tasksClient.queuePath(project, location, queue);

  const task = { // Creating Task and what task it need to perform
    httpRequest: {
      httpMethod: "POST",
      url, // Sending the delete function url
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
    scheduleTime: {
      seconds: Date.now()/1000 + inSeconds,
    },
};
// Creating the task with the previous parameters me made
    await tasksClient.createTask({parent: queuePath, task});

const response = {
    expirable_link: `https://prega-io.vercel.app/${id}`, // Sending back the response.
};

  res.status(200).json(response);
}

async function expireSharedLink(req: Request, res: Response) {
  const {id} = req.body;
  try {
      await admin.firestore().collection("shared-doc").doc(id).delete();
      res.status(200).send("Link Expired");
  } catch (e) {
    functions.logger.error("Error :", e);
  }
}

export const makeExpiryCopy = functions.https.onRequest(makeExpirySharedCopy);
export const expireLink = functions.https.onRequest(expireSharedLink);
