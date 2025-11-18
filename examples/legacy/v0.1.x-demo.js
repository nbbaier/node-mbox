/*
   ⚠️  WARNING: This is the original demo from v0.1.x ⚠️

   This file is kept for historical reference and shows how
   the old v0.1.x API worked with file descriptors.

   This code WILL NOT WORK with v0.2.x!

   For modern examples, see the files in examples/modern/
   For event-based v0.2.x examples, see event-based-usage.js

   Original file: demo.js from node-mbox v0.1.x
   Copyright (C) 2011 Ditesh Shashikant Gathani <ditesh@gathani.org>
*/

var fs = require("fs");
var mbox = require("./main.js").mbox;  // v0.1.x export style
var filename = "mbox";

var count = 0;
var fd = fs.openSync(filename, "r+");  // v0.1.x required file descriptors
var box = new mbox(fd);

box.on("error", function(err) {
    console.log("Some error occurred: " + util.inspect(err));
    console.log("Closing fd and quitting");
    fs.close(fd);
    process.exit(1);
});

box.on("init", function(status, err) {
    if (status) {
        count = box.count();
        console.log("Successfully read mboxrd file ("+count+" messages). Getting messages (if any).");

        if (count > 0) box.get(0);
    } else {
        console.log("Unable to read mboxrd file because " + util.inspect(err));
        console.log("Closing fd and quitting");
        fs.close(fd);
        process.exit(1);
    }
});

box.on("get", function(status, msgnumber, data) {
    if (status === true) {
        console.log("Successfully got msg " + msgnumber);

        if (msgnumber + 1 < count) box.get(msgnumber+1);
        else box.delete(0);
    } else {
        console.log("Unable to get message "+msgnumber);
        console.log("Closing fd and quitting");
        fs.close(fd);
        process.exit(1);
    }
});

box.on("delete", function(status, msgnumber) {
    if (status === true) {
        console.log("Deleted message number " + msgnumber);
        console.log("Writing mboxrd to disk (this closes fd)");
        box.write(filename);  // In v0.1.x this closed the fd
    } else {
        console.log("Unable to delete message number "+msgnumber);
        console.log("Closing fd and quitting");
        fs.close(fd);
        process.exit(1);
    }
});
