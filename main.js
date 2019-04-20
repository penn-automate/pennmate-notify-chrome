(function () {
    'use strict';
    const regex = /^([a-zA-Z]{2,4})\s*-?((?!000)\d{3}|(?!00)\d{2})-?(?!000)(\d{3})$/;

    const messaging = firebase.messaging();
    messaging.usePublicVapidKey('BBhlsokXAodD8g4ZkKxdUDPRr54_89XvRzzX_GdKH1gWiosh-IGvr2tQzerqsexpRxNhUDYL4PatwOutgeLkAHY');
    // messaging.getToken().then(console.log);

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
        const course_human = course.replace(' ', '');
        let html = $('<li class="list-group-item course"><div class="row">' +
            '<div class="col-6">' + course_human + '</div>' +
            '<div class="col-6"><button type="button" class="btn btn-info btn-sm float-right rounded-circle">' +
            '<i class="fa fa-trash-alt fa-sm"></i></button></div>' +
            '</div></li>');
        html.find('button').click(() => {
            let modal = $('<div class="modal fade" tabindex="-1" role="alertdialog">' +
                '  <div class="modal-dialog modal-dialog-centered" role="document">' +
                '    <div class="modal-content">' +
                '      <div class="modal-header">' +
                '        <h5 class="modal-title">Confirm Deletion</h5>' +
                '      </div>' +
                '      <div class="modal-body">' +
                '        Do you really want to delete course ' + course_human + '?' +
                '      </div>' +
                '      <div class="modal-footer">' +
                '        <button type="button" class="btn btn-secondary" data-dismiss="modal">No</button>' +
                '        <button type="button" class="btn btn-primary">Yes</button>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>');
            modal.find('button.btn-primary').click(() => {
                modal.modal('hide');
                html.remove();
                delete_course(course);
            });
            modal.on('hidden.bs.modal', () => modal.remove());
            modal.modal('show');
        });
        c_list.append(html);
    }

    function subscribe_topics(courses) {
        messaging.getToken().then((token) => {
            $.post('https://pennmate.com/subscribe.php', {
                device: token,
                topics: courses.map(x => x.replace(/\s|-/g, s => (s === '-' ? '' : '%'))),
            });
        });
    }

    $(document).ready(() => {
        const course_input = $('input#course');
        const dialog = $('#dialog');
        $('form#course_add').submit(() => {
            const match = check_validity(course_input.val());
            if (match) {
                dialog.modal('hide');
                const category = match[1].trim().toUpperCase();
                const course = match[2].padStart(3, '0');
                const section = match[3];
                const course_id = category.padEnd(4, ' ') + '-' + course + '-' + section;
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
        course_input.change(() => {
            const value = course_input.val();
            if (value === '') {
                $('form#course_add').removeClass('invalid');
            } else {
                check_validity(value);
            }
        });
        dialog.on('hidden.bs.modal', () => {
            course_input.val('');
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