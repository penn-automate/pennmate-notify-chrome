(function () {
    'use strict';
    const regex = /^([a-zA-Z]{2,4})\s*-?((?:(?!0000)\d{4}|(?!000)\d{3}|(?!00)\d{2})[abAB]?)-?([a-zA-Z0-9]{3})$/;
    let courses;
    $.get('https://pennmate.com/courses.php', data => courses = data);

    const messaging = firebase.messaging();
    messaging.usePublicVapidKey('BBhlsokXAodD8g4ZkKxdUDPRr54_89XvRzzX_GdKH1gWiosh-IGvr2tQzerqsexpRxNhUDYL4PatwOutgeLkAHY');

    function check_validity(value) {
        const match = regex.exec(value);
        const form = $('form#course_add');
        if (match === null) {
            form.addClass('invalid');
            return false;
        }
        form.removeClass('invalid');
        return match;
    }

    function delete_course(course) {
        chrome.storage.sync.get('course_list', function (item) {
            let list = item['course_list'].filter(e => e !== course);
            chrome.storage.sync.set({'course_list': list});
            if (list.length <= 0) {
                $('#noc_placeholder').show();
                $('#c_list').hide();
            }
        });
    }

    function add_course(course) {
        $('#noc_placeholder').hide();
        const c_list = $('#c_list');
        c_list.show();
        const match = regex.exec(course);
        const course_human = `${match[1]}-${match[2]}-${match[3]}`;
        let tpl = $('<li class="list-group-item course"><div class="row">' +
            '<div class="col-5 text-nowrap">' + course_human + '</div>' +
            '<div class="col-5 text-info abs-center text-nowrap"></div>' +
            '<div class="col-2"><button type="button" class="btn btn-danger btn-sm btn-block" title="Delete">' +
            '<i class="fa fa-trash-alt fa-sm"></i></button></div>' +
            '</div></li>');
        tpl.find('button').click(() => {
            let modal = $('<div class="modal fade" tabindex="-1" role="alertdialog">' +
                '<div class="modal-dialog modal-dialog-centered" role="document">' +
                '<div class="modal-content">' +
                '<div class="modal-header">' +
                '<h5 class="modal-title">Confirm Deletion</h5>' +
                '</div>' +
                '<div class="modal-body">Do you really want to remove course ' +
                '<span class="text-nowrap">' + course_human + '</span>?' +
                '</div>' +
                '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" data-dismiss="modal">No</button>' +
                '<button type="button" class="btn btn-warning">Yes</button>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>');
            modal.find('button.btn-warning').click(() => {
                modal.modal('hide');
                tpl.remove();
                delete_course(course);
            });
            modal.on('hidden.bs.modal', () => modal.remove());
            modal.modal('show');
        });
        $.get('https://pennmate.com/last_opened.php', {course}, (data) => {
            if (data === '-1') {
                tpl.find('div.text-info').html('Course now opens.');
            } else if (data) {
                const date = new Date(data * 1000);
                const options = {month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'};
                tpl.find('div.text-info').html('Last opened:<br>' +
                    date.toLocaleDateString('en-US', options));
            }
        });
        c_list.append(tpl);
    }

    function subscribe_topics(courses) {
        messaging.getToken().then((token) => {
            $.post('https://pennmate.com/subscribe.php', {
                device: token,
                topics: courses.map(x => x.replace(/\s|-/g, s => (s === '-' ? '' : '%'))),
            });
        });
    }

    function course_typeahead(q, cb) {
        q = q.replace(/\s|-/g, '').toUpperCase();
        cb(courses.filter(s => s['id'].startsWith(q)));
    }

    $(document).ready(() => {
        const course_input = $('input#course');
        const dialog = $('#dialog');
        $('form#course_add').submit(() => {
            const match = check_validity(course_input.val().trim().toUpperCase());
            if (match) {
                dialog.modal('hide');
                const category = match[1];
                const course = match[2].padStart(4, '0');
                const section = match[3];
                const course_id = category + course + section;
                chrome.storage.sync.get('course_list', function (item) {
                    let list = item['course_list'];
                    if (!Array.isArray(list)) {
                        list = [course_id];
                        chrome.storage.sync.set({'course_list': list}, () => add_course(course_id));
                    } else if (!list.includes(course_id)) {
                        list.push(course_id);
                        chrome.storage.sync.set({'course_list': list}, () => add_course(course_id));
                    }
                });
            }
            return false;
        });
        course_input.typeahead({
                classNames: {
                    menu: 'list-group',
                    suggestion: 'list-group-item',
                    cursor: 'active',
                },
                hint: false,
                highlight: false,
                minLength: 1,
            },
            {
                name: 'courses',
                limit: 20,
                displayKey: data => data.id.replace(regex, '$1-$2-$3'),
                source: course_typeahead,
                templates: {
                    suggestion: (l) => {
                        return '<a href="#" class="list-group-item-action">' +
                            '<div class="d-flex w-100 justify-content-between">' +
                            '<h5 class="mb-0">' + l.id.replace(regex, '$1 $2 $3') + '</h5>' +
                            '<small>' + l.act + '</small>' +
                            '</div>' +
                            '<p class="mb-0">' + l.title + '</p>' +
                            '<small>' + l.inst.join(', ') + '</small>' +
                            '</a>';
                    }
                }
            });
        course_input.bind('typeahead:close', () => {
            const value = course_input.val();
            if (value === '') {
                $('form#course_add').removeClass('invalid');
            } else {
                check_validity(value);
            }
        });
        dialog.on('shown.bs.modal', () => {
            course_input.focus();
        }).on('hidden.bs.modal', () => {
            course_input.typeahead('val', '');
            course_input.change();
        });
        chrome.storage.sync.get('course_list', function (item) {
            let list = item['course_list'];
            if (list) {
                subscribe_topics(list);
                list.forEach(add_course);
            }
        });
    });

    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace !== 'sync') return;
        subscribe_topics(changes['course_list']['newValue']);
    });
})();