//set up the startingpoint
var initialTopic = 'privacy';

//import dependencies
var fs = require('fs'),
    _ = require('underscore'),
    Nightmare = require('nightmare'),
    nightmare = Nightmare({
        openDevTools: {
            mode: 'detach'
        },
        show: true
    });

//set dictionary, counters variables, tsv headers
var topics = [],
    articlesLinksList = [],
    paginationNumber = 0,
    edgesHeader = 'source\ttarget\n',
    nodesHeader = 'id\n',
    articlesListHeader = 'ranking\ttitle\tcategory\tauthor\tauthorJob\tlink\ttimestamp\tcomments\tofficialTags\tauthorTags\n';

//get date and create new folder
var d = new Date(),
    date = d.toISOString(),
    newFolder = 'arsTechnicaPrivacy_' + date.substring(0, 10) + '(' + date.substring(11, 13) + '-' + date.substring(14, 16) + '-' + date.substring(17, 19) + ')';

fs.mkdirSync(newFolder);

//create edges tsv file
fs.writeFileSync(newFolder + '/edges.tsv', edgesHeader);
//create nodes tsv file
fs.writeFileSync(newFolder + '/nodes.tsv', nodesHeader);
//create articles list tsv file
fs.writeFileSync(newFolder + '/articlesList.tsv', articlesListHeader);

//function that retrieves all the info from single articles
function getInfo(url, counter) {
    console.log('retrieving info from article n. ' + (counter + 1) + '…');

    nightmare
        .goto(url)
        .wait(3000)
        .evaluate(function() {
            var title = ars.ARTICLE.title,
                category = ars.CATEGORY,
                author = ars.ARTICLE.arsStaff[ars.ARTICLE.author] == undefined ? 'undefined' : ars.ARTICLE.arsStaff[ars.ARTICLE.author].name,
                job = ars.ARTICLE.arsStaff[ars.ARTICLE.author] == undefined ? 'undefined' : ars.ARTICLE.arsStaff[ars.ARTICLE.author].title,
                shortlink = ars.ARTICLE.short_url,
                time = document.querySelector('.content-wrapper header .post-meta time').attributes[1].value,
                comments = ars.ARTICLE.comments,
                officialTags = ars.AD.kw,
                authorTags = digitalData.keywords.display;

            return {
                title: title,
                category: category,
                author: author,
                job: job,
                shortlink: shortlink,
                time: time * 1000,
                comments: comments,
                officialTags: officialTags,
                authorTags: authorTags
            }
        })
        .then(function(articleObject) {
            console.log('Info retrieved.');

            //ready all the variables
            var timestamp = new Date(articleObject.time),
                officialTags = '',
                authorTags = articleObject.authorTags.replace(/type:.*/, '').replace(/\|/g, '; ');

            _.each(articleObject.officialTags, function(tag, index, array) {
                //check if the tags are present in the dictionary
                var match = _.indexOf(topics, tag);
                if (match === -1) {
                    //if not add it and update the nodes tsv
                    topics.push(tag);
                    fs.appendFileSync(newFolder + '/nodes.tsv', tag + '\n');
                }

                //create links between tags and update the edges tsv
                var connectionsArray = _.without(array, tag);
                _.each(connectionsArray, function(target) {
                    fs.appendFileSync(newFolder + '/edges.tsv', tag + '\t' + target + '\n');
                })

                //create the string for the article tsv
                if (index < (array.length - 1)) {
                    officialTags += tag + '; ';
                } else {
                    officialTags += tag
                }
            })

            //push the values to the articles tsv
            var firstHalf = (counter + 1) + '\t' + articleObject.title + '\t' + articleObject.category + '\t' + articleObject.author + '\t' + articleObject.job + '\t',
                secondHalf = articleObject.shortlink + '\t' + timestamp.toLocaleDateString() + '\t' + articleObject.comments + '\t' + officialTags + '\t' + authorTags + '\n',
                newLine = firstHalf + secondHalf;

            fs.appendFileSync(newFolder + '/articlesList.tsv', newLine);

            //repeat until all the articles have been scraped
            if (counter < (articlesLinksList.length - 1)) {
                getInfo(articlesLinksList[counter + 1], (counter + 1));
            } else {
                //close Electron
                nightmare
                    .evaluate()
                    .end()
                    .then();

                console.log('\nDone! Retrived all info.');
            }
        });
}

//function that retrieves all the articles
function getArticles(pag) {
    console.log('going to page ' + pag);
    nightmare
        .click('.gsc-cursor-page:nth-of-type(' + pag + ')')
        .wait(3000)
        .evaluate(function() {
            //harvest the links in the page
            var articlesInPage = document.querySelectorAll('.content-wrapper .gsc-thumbnail-inside div.gs-title a.gs-title'),
                articlesList = [];

            articlesInPage.forEach(function(art) {
                articlesList.push(art.href)
            })

            return articlesList;
        })
        .then(function(articlesList) {
            //push the articles in the final array
            _.each(articlesList, function(art) {
                articlesLinksList.push(art);
            })

            //check if it was the last page or not
            if (pag < paginationNumber) {
                //harvest links from next page
                getArticles(pag + 1);
            } else {
                console.log(articlesLinksList.length + ' articles retrieved! Getting all the info…\n');
                //call next function to retrieve info from single articles
                getInfo(articlesLinksList[0], 0);
            }
        })
}

//function that checks how many articles are there
function checkArticles() {
    console.log('Checking if there is any article related to ' + initialTopic + '…');
    //load page
    nightmare
        .goto('http://arstechnica.com/search/?ie=UTF-8&q=' + initialTopic)
        .wait('.gsc-cursor')
        .evaluate(function() {
            //check how many pages of articles are present
            var pagination = document.querySelectorAll('.gsc-cursor-page').length;

            return pagination;
        })
        .then(function(pagination) {
            console.log('Yes! Retrieving all the articles from the ' + pagination + ' pages…');
            paginationNumber = pagination;
            //start retrieving articles
            getArticles(1);
        })
}

checkArticles();
