/**
 * Golf Stats Tracker — Google Apps Script Web App
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Click Deploy > New deployment
 * 5. Select type: "Web app"
 * 6. Set "Execute as" to "Me"
 * 7. Set "Who has access" to "Anyone"
 * 8. Click Deploy and authorize when prompted
 * 9. Copy the Web App URL and paste it into Golf Stats Tracker settings
 *
 * REDEPLOYING after changes:
 * - Deploy > Manage deployments > Edit (pencil icon) > New version > Deploy
 */

// Handle GET requests (read data from sheets)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { courses: [], rounds: [] };

    // Read Courses sheet
    var coursesSheet = ss.getSheetByName('Courses');
    if (coursesSheet && coursesSheet.getLastRow() > 1) {
      var coursesData = coursesSheet.getRange(2, 1, coursesSheet.getLastRow() - 1, 8).getValues();
      result.courses = coursesData.map(function(row) {
        return {
          id: row[0],
          name: row[1],
          location: row[2],
          numHoles: parseInt(row[3]) || 18,
          rating: parseFloat(row[4]) || 72,
          slope: parseInt(row[5]) || 113,
          totalYardage: parseInt(row[6]) || 0,
          holes: JSON.parse(row[7] || '[]')
        };
      });
    }

    // Read Rounds sheet
    var roundsSheet = ss.getSheetByName('Rounds');
    if (roundsSheet && roundsSheet.getLastRow() > 1) {
      var roundsData = roundsSheet.getRange(2, 1, roundsSheet.getLastRow() - 1, 9).getValues();
      result.rounds = roundsData.map(function(row) {
        return {
          id: row[0],
          courseId: row[1],
          courseName: row[2],
          date: row[3],
          tees: row[4],
          totalScore: parseInt(row[5]) || 0,
          courseRating: parseFloat(row[6]) || 72,
          slopeRating: parseInt(row[7]) || 113,
          holes: JSON.parse(row[8] || '[]')
        };
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests (write data to sheets)
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Write courses
    if (payload.courses) {
      var coursesSheet = getOrCreateSheet(ss, 'Courses',
        ['ID', 'Name', 'Location', 'Holes', 'Rating', 'Slope', 'Yardage', 'Hole Data']);

      // Clear existing data (keep header)
      if (coursesSheet.getLastRow() > 1) {
        coursesSheet.getRange(2, 1, coursesSheet.getLastRow() - 1, 8).clear();
      }

      // Write new data
      if (payload.courses.length > 0) {
        var courseRows = payload.courses.map(function(c) {
          return [c.id, c.name, c.location, c.numHoles, c.rating, c.slope, c.totalYardage, JSON.stringify(c.holes)];
        });
        coursesSheet.getRange(2, 1, courseRows.length, 8).setValues(courseRows);
      }
    }

    // Write rounds
    if (payload.rounds) {
      var roundsSheet = getOrCreateSheet(ss, 'Rounds',
        ['ID', 'Course ID', 'Course Name', 'Date', 'Tees', 'Score', 'Rating', 'Slope', 'Hole Data']);

      // Clear existing data (keep header)
      if (roundsSheet.getLastRow() > 1) {
        roundsSheet.getRange(2, 1, roundsSheet.getLastRow() - 1, 9).clear();
      }

      // Write new data
      if (payload.rounds.length > 0) {
        var roundRows = payload.rounds.map(function(r) {
          return [r.id, r.courseId, r.courseName, r.date, r.tees, r.totalScore, r.courseRating, r.slopeRating, JSON.stringify(r.holes)];
        });
        roundsSheet.getRange(2, 1, roundRows.length, 9).setValues(roundRows);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Get existing sheet or create with headers
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}
