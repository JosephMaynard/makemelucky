module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['src/vendor/*.js', 'src/js/charms.js', 'src/js/storage.js', 'src/js/screen.js', 'src/js/particles.js', 'src/js/effects.js', 'src/js/buttons.js', 'src/js/startup.js '],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! Make Me Lucky | (c) 2015 Joseph Maynard  | josephmaynard.co.uk | <%= grunt.template.today("dd-mm-yyyy") %> \n'
         + 'jQuery v1.11.0 | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license\n'
         + 'Velocity.js | VelocityJS.org | v1.2.2 | (c) 2014 Julian Shapiro.\n'
         + 'Howler.js | v1.1.26 | howlerjs.com | (c) 2013-2015, James Simpson of GoldFire Studios goldfirestudios.com*/\n'
      },
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    cssmin: {
      options: {
        shorthandCompacting: false,
        roundingPrecision: -1
      },
      target: {
        files: [{
          expand: true,
          src: ['src/makemelucky2.css'],
          dest: 'dist',
          cwd: 'dist'
        }]
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint', 'qunit']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');

  grunt.registerTask('test', ['jshint', 'qunit']);

  //grunt.registerTask('default', ['jshint', 'qunit', 'concat', 'uglify']);
  grunt.registerTask('default', ['concat', 'uglify','cssmin']);

};