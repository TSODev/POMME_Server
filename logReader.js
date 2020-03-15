'use strict'

const fs = require('fs'),
    es = require('event-stream');



class MetricsLogReader {
  constructor(filename, batchSize) {
    this.reader = fs.createReadStream(filename)
    this.lineNumber = 0
    this.data = []
  }

  read(callback) {

    this.reader
      .pipe(es.split())
      .pipe(es.mapSync(line => {
        ++this.lineNumber;

        this.reader.pause();

        let values = null;
        let date = null;
        let valid = true;
        try {
            values = line.match(/(?<=\@)[^\0]+?(?=\@)/i)[0];  
        } catch (error) {
            values = 'error';  
            valid = false;          
        }

        try {
            date = line.match(/(?<=\[)[^\0]+?(?=\])/i)[0];   
        } catch (error) {
            date = 'error' ;
            valid = false ; 
        }

//         const metric = line.match(/(?<=\@)[^\0]+?(?=\@)/i)[0];
//         const date = line.match(/(?<=\[)[^\0]+?(?=\])/i)[0];
         const num = this.lineNumber;

         this.data = {valid, num, date, values};
         callback(this.data);

      })
      .on('error', function(err){
          console.log('Error while reading file.', err)
          callback({num: 'error', date:'error', metric: 'error'});
      })
      .on('end', function(){
          console.log('Read entirefile.')
      }))
  }

  continue () {
    this.data = []
    this.reader.resume()
  }
}

module.exports = MetricsLogReader
