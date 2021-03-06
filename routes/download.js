var express = require('express'),
    path = require('path'),
    Operator = require('./../lib/operator'),
    GetModel = require('./../lib/mongo'),
    Filter =require('./../spider/class/filter'),
    fs = require('fs'),
    fstream = require('fstream'),
    tar = require('tar'),
    zlib = require('zlib');

var BOOK = GetModel('Work');

var router = express.Router();

router.post('/',function(req,res){
    console.log('POST /download');
    console.log(req.body);
    req.session.selectedSize = req.body.selectedSize;
    req.session.save();
    var praise =''+req.body.praise || '0';
    var pageView =''+req.body.pageView || '0';
    var pixiver =''+req.body.id || 0;
    if(req.body.has_tag_every){
      var has_tag_every =req.body.has_tag_every.split(' ') || [];
    }else {
      var has_tag_every =[];
    }
    if(req.body.has_tag_some){
      var has_tag_some =req.body.has_tag_some.split(' ') || [];
    }else {
      var has_tag_some =[];
    }
    if(req.body.no_tag_any){
      var no_tag_any =req.body.no_tag_any.split(' ') || [];
    }else {
      var no_tag_any =[];
    }
    if(req.body.no_tag_every){
      var no_tag_every =req.body.no_tag_every.split(' ') || [];
    }else {
      var no_tag_every =[];
    }

    var filterCondition ={
      //"has_tag_every":has_tag_every,
      "has_tag_some":has_tag_some,
      "no_tag_any":no_tag_any,
      "no_tag_every":no_tag_every
    }
    var filter = new Filter(filterCondition);
    //console.log('filterCondition: '+JSON.stringify(filterCondition));
    var reg_keywords =[];
    has_tag_every.map(function(item){
        let t = new RegExp(item,'i');
        reg_keywords.push(t);
    })
    var condition ={
      'praise': {$gte:praise},
      'pageView': {$gte:pageView}
    }
    if(has_tag_every && has_tag_every.length !== 0){
        condition =Object.assign(condition,{tags: {$in: reg_keywords}});
    }
    if(pixiver){
        condition =Object.assign(condition,{'pixiver':pixiver});
    }
    console.log('condition: '+JSON.stringify(condition));
    var query =BOOK.find(condition);
    query.limit(100);
    query.sort({praise:-1});
    //query.select('small_address');

    query.exec(function(err,resultSet){
      console.log('length: '+resultSet.length);
      //resultSet =filter.filter(resultSet);

      res.render('download',{
          size:req.session.selectedSize || 'small',
          db:true,
          items:resultSet,
          length:resultSet.length
      });

    });

});


router.get('/works',function(req,res,next){
    if(req.session.items){
        var zip ='output.tar.gz';
        var folder = req.session.group;
        (function(zip,folder){
            fs.exists('./public/images/download/'+folder+'/'+zip,function(exists){
                if(!exists){
                    console.log('压缩文件不存在');
                    try {
                        fstream.Reader({'path':'./public/images/download/'+folder,'type':'Directory'})
        	               .pipe(tar.Pack())
        	                  .pipe(zlib.Gzip())
        	                     .pipe(fstream.Writer({'path':'./public/images/download/'+folder+'/'+zip}))
                                    .on('close',function(){console.log('压缩完毕')});
                    } catch (e) {
                        console.log(e);
                    } finally {

                    }

                }
            });
        })(zip,folder);
        var items =req.session.items;
        items.sort(function(a,b){
            return b.praise - a.praise;
        });
        res.render('download_works',{
          group:req.session.group,    //表作品被分到哪一组
          works:items,
          number:items.length
        });
    }else {
        next();
    }
});

router.get('/works/:filename',function(req,res,next){
    var filename = req.params.filename;
	//console.log('下载请求：'+filename);
    //var folder = req.session.group || 'db';
    var folder = req.session.group;
	var filepath = path.join(__dirname,'../','public','images','download',folder,filename);
	var stats = fs.statSync(filepath);
	if(stats.isFile()){
		res.set({
			'Content-Type':'application/octet-stream',
			'Content-Disposition': 'attachment; filename='+filename,
   			'Content-Length': stats.size
		});
		fs.createReadStream(filepath).pipe(res).on('error',function(err){
            console.log('下载错误');
            console.log(err);
        });
	}else{
		res.end(404);
	}
});

module.exports = router;
