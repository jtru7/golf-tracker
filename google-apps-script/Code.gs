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
      var numCols = coursesSheet.getLastColumn();
      var coursesData = coursesSheet.getRange(2, 1, coursesSheet.getLastRow() - 1, numCols).getValues();
      result.courses = coursesData.map(function(row) {
        // New format (6 columns): ID, Name, Location, Holes, Tees JSON, Hole Data
        if (numCols >= 6 && typeof row[4] === 'string' && row[4].charAt(0) === '{') {
          return {
            id: String(row[0]),
            name: row[1],
            location: row[2],
            numHoles: parseInt(row[3]) || 9,
            tees: JSON.parse(row[4] || '{}'),
            holes: JSON.parse(row[5] || '[]')
          };
        }
        // Old format (8 columns): ID, Name, Location, Holes, Rating, Slope, Yardage, Hole Data
        // Migrate to tees.white on read
        return {
          id: row[0],
          name: row[1],
          location: row[2],
          numHoles: parseInt(row[3]) || 9,
          tees: {
            red:   { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [], handicaps: [] },
            white: { enabled: true, rating: parseFloat(row[4]) || null, slope: parseInt(row[5]) || null, totalYardage: parseInt(row[6]) || null, yardages: [], handicaps: [] },
            blue:  { enabled: false, rating: null, slope: null, totalYardage: null, yardages: [], handicaps: [] }
          },
          holes: JSON.parse(row[numCols >= 8 ? 7 : 5] || '[]')
        };
      });
    }

    // Read Rounds sheet
    var roundsSheet = ss.getSheetByName('Rounds');
    if (roundsSheet && roundsSheet.getLastRow() > 1) {
      var numRoundCols = roundsSheet.getLastColumn();
      var roundsData = roundsSheet.getRange(2, 1, roundsSheet.getLastRow() - 1, numRoundCols).getValues();
      result.rounds = roundsData.map(function(row) {
        // New format (11 columns): ID, Course ID, Course Name, Date, Tees, Num Holes, Round Type, Score, Rating, Slope, Hole Data
        if (numRoundCols >= 11) {
          return {
            id: String(row[0]),
            courseId: String(row[1]),
            courseName: row[2],
            date: row[3] instanceof Date ? row[3].toISOString().split('T')[0] : String(row[3]),
            tees: row[4],
            numHoles: parseInt(row[5]) || 9,
            roundType: row[6] || 'normal',
            totalScore: parseInt(row[7]) || 0,
            courseRating: parseFloat(row[8]) || null,
            slopeRating: parseInt(row[9]) || null,
            holes: JSON.parse(row[10] || '[]')
          };
        }
        // Old format (9 columns): ID, Course ID, Course Name, Date, Tees, Score, Rating, Slope, Hole Data
        return {
          id: row[0],
          courseId: row[1],
          courseName: row[2],
          date: row[3] instanceof Date ? row[3].toISOString().split('T')[0] : String(row[3]),
          tees: row[4],
          numHoles: 9,
          roundType: 'normal',
          totalScore: parseInt(row[5]) || 0,
          courseRating: parseFloat(row[6]) || null,
          slopeRating: parseInt(row[7]) || null,
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
      var courseHeaders = ['ID', 'Name', 'Location', 'Holes', 'Tees Data', 'Hole Data'];
      var coursesSheet = getOrCreateSheet(ss, 'Courses', courseHeaders);

      // Clear existing data (keep header)
      if (coursesSheet.getLastRow() > 1) {
        coursesSheet.getRange(2, 1, coursesSheet.getLastRow() - 1, coursesSheet.getLastColumn()).clear();
      }

      // Update headers if column count changed (old → new format)
      coursesSheet.getRange(1, 1, 1, courseHeaders.length).setValues([courseHeaders]);

      // Write new data
      if (payload.courses.length > 0) {
        var courseRows = payload.courses.map(function(c) {
          return [
            c.id,
            c.name,
            c.location,
            c.numHoles,
            JSON.stringify(c.tees || {}),
            JSON.stringify(c.holes)
          ];
        });
        coursesSheet.getRange(2, 1, courseRows.length, 6).setValues(courseRows);
      }
    }

    // Write rounds
    if (payload.rounds) {
      var roundHeaders = ['ID', 'Course ID', 'Course Name', 'Date', 'Tees', 'Num Holes', 'Round Type', 'Score', 'Rating', 'Slope', 'Hole Data'];
      var roundsSheet = getOrCreateSheet(ss, 'Rounds', roundHeaders);

      // Clear existing data (keep header)
      if (roundsSheet.getLastRow() > 1) {
        roundsSheet.getRange(2, 1, roundsSheet.getLastRow() - 1, roundsSheet.getLastColumn()).clear();
      }

      // Update headers if column count changed (old → new format)
      roundsSheet.getRange(1, 1, 1, roundHeaders.length).setValues([roundHeaders]);

      // Write new data
      if (payload.rounds.length > 0) {
        var roundRows = payload.rounds.map(function(r) {
          return [
            r.id,
            r.courseId,
            r.courseName,
            r.date,
            r.tees,
            r.numHoles || 9,
            r.roundType || 'normal',
            r.totalScore,
            r.courseRating,
            r.slopeRating,
            JSON.stringify(r.holes)
          ];
        });
        roundsSheet.getRange(2, 1, roundRows.length, 11).setValues(roundRows);
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
